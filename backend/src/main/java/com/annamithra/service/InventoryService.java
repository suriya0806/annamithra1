package com.annamithra.service;

import com.annamithra.dto.CreateItemRequest;
import com.annamithra.dto.DirectReceiptRequest;
import com.annamithra.dto.DirectStockRequest;
import com.annamithra.dto.DirectStockResponseDto;
import com.annamithra.dto.GoodsReceiptResponseDto;
import com.annamithra.model.InventoryTransaction;
import com.annamithra.model.Item;
import com.annamithra.model.PurchaseOrder;
import com.annamithra.repository.InventoryTransactionRepository;
import com.annamithra.repository.ItemRepository;
import com.annamithra.repository.PurchaseOrderRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class InventoryService {
    private final ItemRepository itemRepo;
    private final InventoryTransactionRepository transactionRepo;
    private final PurchaseOrderRepository purchaseOrderRepo;
    private final PurchaseOrderService purchaseOrderService;

    public InventoryService(ItemRepository itemRepo,
                            InventoryTransactionRepository transactionRepo,
                            PurchaseOrderRepository purchaseOrderRepo,
                            PurchaseOrderService purchaseOrderService) {
        this.itemRepo = itemRepo;
        this.transactionRepo = transactionRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.purchaseOrderService = purchaseOrderService;
    }

    public List<Item> getCentralInventory() {
        return itemRepo.findAllByOrderByNameAsc();
    }

    public List<Item> getCentralInventory(Long organisationId) {
        if (organisationId == null) {
            return itemRepo.findAllByOrderByNameAsc();
        }
        return itemRepo.findByOrganisationIdOrderByNameAsc(organisationId);
    }

    public List<Item> getAllItems() {
        return itemRepo.findAllByOrderByNameAsc();
    }

    public List<Item> getAllItems(Long organisationId) {
        if (organisationId == null) {
            return itemRepo.findAllByOrderByNameAsc();
        }
        return itemRepo.findByOrganisationIdOrderByNameAsc(organisationId);
    }

    @Transactional
    public Item createItem(CreateItemRequest req, String username) {
        return createItem(req, null, username);
    }

    @Transactional
    public Item createItem(CreateItemRequest req, Long organisationId, String username) {
        if (req == null || req.name == null || req.name.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item name is required");
        }
        if (req.unit == null || req.unit.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit is required");
        }

        String cleanedName = req.name.trim();
        String cleanedUnit = req.unit.trim();

        Optional<Item> existing;
        if (organisationId != null) {
            existing = itemRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedName);
        } else {
            existing = itemRepo.findByNameIgnoreCase(cleanedName);
        }

        if (existing.isPresent()) {
            Item ex = existing.get();
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Item '" + cleanedName + "' already exists in the catalogue (Unit: " + ex.unit + ")");
        }

        Item newItem = new Item(organisationId, cleanedName, cleanedUnit, 0);
        newItem.createdAt = LocalDateTime.now();
        return itemRepo.save(newItem);
    }

    @Transactional
    public DirectStockResponseDto addDirectStock(DirectStockRequest req, String username) {
        return addDirectStock(req, null, username);
    }

    @Transactional
    public DirectStockResponseDto addDirectStock(DirectStockRequest req, Long organisationId, String username) {
        String rawItemName = req != null ? req.getItemName() : null;
        if (req == null || rawItemName == null || rawItemName.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item name is required");
        }
        if (req.unit == null || req.unit.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit is required");
        }
        if (req.quantity == null || req.quantity <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be greater than zero");
        }

        String cleanedName = rawItemName.trim();
        String cleanedUnit = req.unit.trim();
        int qtyToAdd = req.quantity;
        String user = (username != null && !username.isBlank()) ? username : "Store Manager";

        Optional<Item> existingOpt;
        if (organisationId != null) {
            existingOpt = itemRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedName);
        } else {
            existingOpt = itemRepo.findByNameIgnoreCase(cleanedName);
        }

        Item item;
        boolean isNewItem = false;

        if (existingOpt.isPresent()) {
            item = existingOpt.get();
            item.stock += qtyToAdd;
        } else {
            item = new Item(organisationId, cleanedName, cleanedUnit, qtyToAdd);
            item.createdAt = LocalDateTime.now();
            isNewItem = true;
        }

        Item savedItem = itemRepo.save(item);

        InventoryTransaction tx = new InventoryTransaction(
            organisationId,
            savedItem.name,
            savedItem.unit,
            "RECEIPT",
            qtyToAdd,
            "DIRECT_STOCK_ENTRY",
            null,
            savedItem.stock,
            user
        );
        tx.transactionDate = LocalDateTime.now();
        transactionRepo.save(tx);

        return new DirectStockResponseDto(
            savedItem.name,
            savedItem.unit,
            qtyToAdd,
            savedItem.stock,
            isNewItem
        );
    }

    @Transactional
    public GoodsReceiptResponseDto recordGoodsReceipt(DirectReceiptRequest req, String username) {
        return recordGoodsReceipt(req, null, username);
    }

    @Transactional
    public GoodsReceiptResponseDto recordGoodsReceipt(DirectReceiptRequest req, Long organisationId, String username) {
        if (req == null || req.itemName == null || req.itemName.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item name is required");
        }
        if (req.receivedQty == null || req.receivedQty <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Received quantity must be greater than zero");
        }

        String cleanedName = req.itemName.trim();
        Optional<Item> itemOpt = organisationId != null
            ? itemRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedName)
            : itemRepo.findByNameIgnoreCase(cleanedName);

        Item item = itemOpt
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item '" + cleanedName + "' not found in catalogue"));

        String user = (username != null && !username.isBlank()) ? username : "Store Manager";

        List<PurchaseOrder> activeOrders;
        if (organisationId != null) {
            activeOrders = purchaseOrderRepo.findByOrganisationIdAndItemIgnoreCaseOrderByCreatedAtAsc(organisationId, cleanedName)
                .stream()
                .filter(po -> "ORDERED".equalsIgnoreCase(po.status) || "PARTIALLY_RECEIVED".equalsIgnoreCase(po.status))
                .filter(po -> (po.quantity - po.receivedQty) > 0)
                .toList();
        } else {
            activeOrders = purchaseOrderRepo.findByItemIgnoreCaseOrderByCreatedAtAsc(cleanedName)
                .stream()
                .filter(po -> "ORDERED".equalsIgnoreCase(po.status) || "PARTIALLY_RECEIVED".equalsIgnoreCase(po.status))
                .filter(po -> (po.quantity - po.receivedQty) > 0)
                .toList();
        }

        if (!activeOrders.isEmpty()) {
            PurchaseOrder po = activeOrders.get(0);
            int remaining = Math.max(0, po.quantity - po.receivedQty);
            int qtyToReceive = Math.min(req.receivedQty, remaining);

            PurchaseOrder updatedPo = purchaseOrderService.receiveOrderGoods(po.id, qtyToReceive, user, organisationId);
            Item updatedItem = (organisationId != null
                ? itemRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedName)
                : itemRepo.findByNameIgnoreCase(cleanedName)).orElse(item);

            String poRef = updatedPo.poNumber != null ? updatedPo.poNumber : ("PO-" + updatedPo.id);
            return new GoodsReceiptResponseDto(updatedItem.name, updatedItem.unit, qtyToReceive, updatedItem.stock, "LINKED_PO", poRef, updatedPo.status);
        } else {
            item.stock += req.receivedQty;
            itemRepo.save(item);

            InventoryTransaction tx = new InventoryTransaction(
                organisationId,
                item.name,
                item.unit,
                "RECEIPT",
                req.receivedQty,
                "GOODS_RECEIPT",
                null,
                item.stock,
                user
            );
            if (req.receiptDate != null) {
                tx.transactionDate = req.receiptDate.atStartOfDay();
            }
            transactionRepo.save(tx);

            return new GoodsReceiptResponseDto(item.name, item.unit, req.receivedQty, item.stock, "DIRECT_ENTRY", null, "COMPLETED");
        }
    }

    public List<InventoryTransaction> getTransactions(LocalDate date, String itemName) {
        return getTransactions(null, date, null, null, itemName);
    }

    public List<InventoryTransaction> getTransactions(LocalDate date, LocalDate fromDate, LocalDate toDate, String itemName) {
        return getTransactions(null, date, fromDate, toDate, itemName);
    }

    public List<InventoryTransaction> getTransactions(Long organisationId, LocalDate date, LocalDate fromDate, LocalDate toDate, String itemName) {
        List<InventoryTransaction> list = organisationId != null
            ? transactionRepo.findByOrganisationIdOrderByTransactionDateDesc(organisationId)
            : transactionRepo.findAllByOrderByTransactionDateDesc();

        return list.stream()
            .filter(tx -> {
                if (tx.transactionDate == null) return date == null && fromDate == null && toDate == null;
                LocalDate d = tx.transactionDate.toLocalDate();
                if (date != null) {
                    return d.equals(date);
                }
                if (fromDate != null && d.isBefore(fromDate)) return false;
                if (toDate != null && d.isAfter(toDate)) return false;
                return true;
            })
            .filter(tx -> itemName == null || itemName.isBlank() || (tx.itemName != null && tx.itemName.toLowerCase().contains(itemName.trim().toLowerCase())))
            .toList();
    }
}
