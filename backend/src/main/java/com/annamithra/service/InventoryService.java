package com.annamithra.service;

import com.annamithra.dto.CreateItemRequest;
import com.annamithra.dto.UpdateItemRequest;
import com.annamithra.dto.DirectReceiptRequest;
import com.annamithra.dto.DirectStockRequest;
import com.annamithra.dto.DirectStockResponseDto;
import com.annamithra.dto.GoodsReceiptResponseDto;
import com.annamithra.model.InventoryTransaction;
import com.annamithra.model.Item;
import com.annamithra.model.ItemCategory;
import com.annamithra.model.PurchaseOrder;
import com.annamithra.repository.InventoryTransactionRepository;
import com.annamithra.repository.ItemCategoryRepository;
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
    private final ItemCategoryRepository categoryRepo;

    public InventoryService(ItemRepository itemRepo,
                            InventoryTransactionRepository transactionRepo,
                            PurchaseOrderRepository purchaseOrderRepo,
                            PurchaseOrderService purchaseOrderService,
                            ItemCategoryRepository categoryRepo) {
        this.itemRepo = itemRepo;
        this.transactionRepo = transactionRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.purchaseOrderService = purchaseOrderService;
        this.categoryRepo = categoryRepo;
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
        String cleanedUnit = req.unit.trim().toUpperCase();
        String cleanedCategory = (req.category != null && !req.category.isBlank()) ? req.category.trim() : null;
        Long categoryId = req.categoryId;

        // If categoryId is provided, resolve category name
        if (categoryId != null) {
            Optional<ItemCategory> catOpt = categoryRepo.findById(categoryId);
            if (catOpt.isPresent()) {
                cleanedCategory = catOpt.get().name;
            }
        } else if (cleanedCategory != null) {
            // If category name is provided, resolve or find categoryId
            Optional<ItemCategory> catOpt = (organisationId != null)
                    ? categoryRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedCategory)
                    : categoryRepo.findByNameIgnoreCase(cleanedCategory);
            if (catOpt.isPresent()) {
                categoryId = catOpt.get().id;
                cleanedCategory = catOpt.get().name;
            }
        }

        Optional<Item> existing;
        if (organisationId != null) {
            existing = itemRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedName);
        } else {
            existing = itemRepo.findByNameIgnoreCase(cleanedName);
        }

        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item already exists.");
        }

        // Maintaining item master only: initial stock = 0, no stock/receipt changes
        Item newItem = new Item(organisationId, cleanedName, cleanedUnit, 0, cleanedCategory, categoryId, username);
        newItem.createdAt = LocalDateTime.now();
        newItem.updatedAt = LocalDateTime.now();
        return itemRepo.save(newItem);
    }

    @Transactional
    public Item updateItem(Long id, UpdateItemRequest req, Long organisationId, String username) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item ID is required");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        Item item = itemRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));

        if (organisationId != null && item.organisationId != null && !item.organisationId.equals(organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot modify another organisation's item");
        }

        if (req.name != null && !req.name.trim().isEmpty()) {
            String cleanedName = req.name.trim();
            if (!cleanedName.equalsIgnoreCase(item.name)) {
                // Check duplicate within organisation
                Optional<Item> duplicate = (organisationId != null)
                        ? itemRepo.findByOrganisationIdAndNameIgnoreCaseAndIdNot(organisationId, cleanedName, id)
                        : itemRepo.findByNameIgnoreCaseAndIdNot(cleanedName, id);

                if (duplicate.isPresent()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Item already exists.");
                }
                item.name = cleanedName;
            }
        }

        if (req.unit != null && !req.unit.trim().isEmpty()) {
            item.unit = req.unit.trim().toUpperCase();
        }

        if (req.categoryId != null) {
            item.categoryId = req.categoryId;
            Optional<ItemCategory> catOpt = categoryRepo.findById(req.categoryId);
            if (catOpt.isPresent()) {
                item.category = catOpt.get().name;
            }
        } else if (req.category != null && !req.category.isBlank()) {
            String cleanedCat = req.category.trim();
            item.category = cleanedCat;
            Optional<ItemCategory> catOpt = (organisationId != null)
                    ? categoryRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedCat)
                    : categoryRepo.findByNameIgnoreCase(cleanedCat);
            if (catOpt.isPresent()) {
                item.categoryId = catOpt.get().id;
                item.category = catOpt.get().name;
            }
        }

        // Invariant: Adding or editing an item never changes stock quantities!
        item.updatedAt = LocalDateTime.now();
        return itemRepo.save(item);
    }

    @Transactional
    public DirectStockResponseDto addDirectStock(DirectStockRequest req, String username) {
        return addDirectStock(req, null, username, null);
    }

    @Transactional
    public DirectStockResponseDto addDirectStock(DirectStockRequest req, Long organisationId, String username) {
        return addDirectStock(req, organisationId, username, null);
    }

    @Transactional
    public DirectStockResponseDto addDirectStock(DirectStockRequest req, Long organisationId, String username, Long adminId) {
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
        String cleanedCategory = (req.category != null && !req.category.isBlank()) ? req.category.trim() : null;
        double qtyToAdd = req.quantity;
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
            if (cleanedCategory != null && (item.category == null || item.category.isBlank())) {
                item.category = cleanedCategory;
            }
        } else {
            item = new Item(organisationId, cleanedName, cleanedUnit, qtyToAdd, cleanedCategory);
            item.createdAt = LocalDateTime.now();
            isNewItem = true;
        }

        Item savedItem = itemRepo.save(item);

        InventoryTransaction tx = new InventoryTransaction(
            organisationId,
            savedItem.name,
            (cleanedCategory != null ? cleanedCategory : savedItem.category),
            savedItem.unit,
            "RECEIPT",
            qtyToAdd,
            "DIRECT_STOCK_ENTRY",
            null,
            savedItem.stock,
            user,
            adminId
        );

        LocalDate effectiveDate = req.getEffectiveDate();
        if (effectiveDate != null) {
            tx.transactionDate = effectiveDate.atTime(java.time.LocalTime.now());
        } else {
            tx.transactionDate = LocalDateTime.now();
        }
        InventoryTransaction savedTx = transactionRepo.save(tx);

        return new DirectStockResponseDto(
            savedTx.id,
            savedItem.id,
            savedItem.name,
            savedItem.category,
            savedItem.unit,
            qtyToAdd,
            savedItem.stock,
            isNewItem,
            savedTx.transactionDate,
            savedTx.createdByAdminId,
            savedTx.organisationId,
            savedTx.performedBy
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
        if (req.receivedQty == null || req.receivedQty <= 0.0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Received quantity must be greater than zero");

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
            double remaining = Math.max(0.0, po.quantity - po.receivedQty);
            double qtyToReceive = Math.min(req.receivedQty, remaining);

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
        return getTransactions(organisationId, date, fromDate, toDate, itemName, null);
    }

    public List<InventoryTransaction> getTransactions(Long organisationId, LocalDate date, LocalDate fromDate, LocalDate toDate, String itemName, String category) {
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
            .filter(tx -> category == null || category.isBlank() || "ALL".equalsIgnoreCase(category) || (tx.category != null && tx.category.equalsIgnoreCase(category.trim())))
            .toList();
    }
}
