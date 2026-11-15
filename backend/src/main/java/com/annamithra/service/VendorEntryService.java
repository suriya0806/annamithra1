package com.annamithra.service;

import com.annamithra.dto.*;
import com.annamithra.model.*;
import com.annamithra.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class VendorEntryService {

    private final VendorRepository vendorRepo;
    private final VendorInventoryEntryRepository entryRepo;
    private final VendorInventoryEntryItemRepository entryItemRepo;
    private final ItemRepository itemRepo;
    private final InventoryTransactionRepository txRepo;

    public VendorEntryService(VendorRepository vendorRepo,
                              VendorInventoryEntryRepository entryRepo,
                              VendorInventoryEntryItemRepository entryItemRepo,
                              ItemRepository itemRepo,
                              InventoryTransactionRepository txRepo) {
        this.vendorRepo = vendorRepo;
        this.entryRepo = entryRepo;
        this.entryItemRepo = entryItemRepo;
        this.itemRepo = itemRepo;
        this.txRepo = txRepo;
    }

    // -------------------------------------------------------------
    // VENDOR MANAGEMENT
    // -------------------------------------------------------------

    public List<Vendor> getVendors(Long organisationId, String search) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }
        if (search != null && !search.isBlank()) {
            return vendorRepo.findByOrganisationIdAndNameContainingIgnoreCaseAndActiveTrueOrderByNameAsc(organisationId, search.trim());
        }
        return vendorRepo.findByOrganisationIdAndActiveTrueOrderByNameAsc(organisationId);
    }

    @Transactional
    public Vendor getOrCreateVendor(Long organisationId, String name, String username) {
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vendor name is required");
        }
        String cleanName = name.trim();
        Optional<Vendor> existing = vendorRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanName);
        if (existing.isPresent()) {
            return existing.get();
        }

        Vendor v = new Vendor(organisationId, cleanName, null, null, null, username);
        return vendorRepo.save(v);
    }

    @Transactional
    public Vendor createVendor(Long organisationId, CreateVendorRequest req, String username) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }
        if (req == null || req.name == null || req.name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vendor name is required");
        }
        String cleanName = req.name.trim();
        Optional<Vendor> existing = vendorRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanName);
        if (existing.isPresent()) {
            return existing.get();
        }

        Vendor v = new Vendor(
            organisationId,
            cleanName,
            req.contactPhone != null ? req.contactPhone.trim() : null,
            req.address != null ? req.address.trim() : null,
            req.gstNumber != null ? req.gstNumber.trim().toUpperCase() : null,
            username
        );
        return vendorRepo.save(v);
    }

    // -------------------------------------------------------------
    // VENDOR INVENTORY ENTRY (ATOMIC STOCK INCREMENT)
    // -------------------------------------------------------------

    @Transactional
    public VendorEntryDto saveVendorEntry(Long organisationId, VendorEntryRequest req, String username, Long userId) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        // 1. Idempotency Check: Prevent duplicate submissions
        if (req.clientSubmissionId != null && !req.clientSubmissionId.isBlank()) {
            String submissionId = req.clientSubmissionId.trim();
            Optional<VendorInventoryEntry> existingEntry = entryRepo.findByOrganisationIdAndClientSubmissionId(organisationId, submissionId);
            if (existingEntry.isPresent()) {
                return toDto(existingEntry.get(), entryItemRepo.findByEntryIdOrderByIdAsc(existingEntry.get().id));
            }
        }

        // 2. Resolve / Create Vendor
        Vendor vendor;
        if (req.vendorId != null) {
            vendor = vendorRepo.findById(req.vendorId)
                .filter(v -> v.organisationId.equals(organisationId))
                .orElseGet(() -> getOrCreateVendor(organisationId, req.vendorName, username));
        } else if (req.vendorName != null && !req.vendorName.isBlank()) {
            vendor = getOrCreateVendor(organisationId, req.vendorName, username);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vendor Name or Vendor ID is required");
        }

        // 3. Validate Items List
        if (req.items == null || req.items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one item is required in vendor inventory entry");
        }

        LocalDate entryDate = req.entryDate != null ? req.entryDate : LocalDate.now();
        LocalDateTime entryDateTime = LocalDateTime.now();

        String paymentMode = (req.paymentMode != null && !req.paymentMode.isBlank())
            ? req.paymentMode.trim().toUpperCase()
            : "CASH";
        if (!List.of("CASH", "UPI", "BANK_TRANSFER", "CREDIT").contains(paymentMode)) {
            paymentMode = "CASH";
        }

        // 4. Create and Save Entry Header (temporary total values)
        VendorInventoryEntry entry = new VendorInventoryEntry(
            organisationId,
            vendor.id,
            vendor.name,
            entryDate,
            entryDateTime,
            req.remarks != null ? req.remarks.trim() : null,
            req.clientSubmissionId != null ? req.clientSubmissionId.trim() : null,
            username,
            userId
        );
        entry.paymentMode = paymentMode;
        entry.receivedBy = (req.receivedBy != null && !req.receivedBy.isBlank()) ? req.receivedBy.trim() : null;
        entry.broughtBy = (req.broughtBy != null && !req.broughtBy.isBlank()) ? req.broughtBy.trim() : null;
        entry = entryRepo.save(entry);
        entry.entryNumber = "VND-" + String.format("%05d", entry.id);
        entry = entryRepo.save(entry);

        BigDecimal totalQty = BigDecimal.ZERO;
        BigDecimal grandTotal = BigDecimal.ZERO;
        List<VendorInventoryEntryItem> savedItems = new ArrayList<>();

        // 5. Process Each Item Atomically with Pessimistic Locking
        for (VendorEntryRequest.VendorEntryItemRequest line : req.items) {
            if (line == null) continue;
            if (line.itemId == null && (line.itemName == null || line.itemName.isBlank())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item identifier or name is required");
            }
            if (line.quantity == null || line.quantity <= 0.0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be greater than zero for item " + (line.itemName != null ? line.itemName : "ID " + line.itemId));
            }

            // Acquire Pessimistic Write Lock on existing item
            Item item;
            if (line.itemId != null) {
                item = itemRepo.findByIdAndOrganisationIdForUpdate(line.itemId, organisationId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item ID " + line.itemId + " not found in organisation"));
            } else {
                item = itemRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, line.itemName.trim())
                    .flatMap(it -> itemRepo.findByIdAndOrganisationIdForUpdate(it.id, organisationId))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item '" + line.itemName + "' not found in catalogue"));
            }

            BigDecimal qtyToAdd = BigDecimal.valueOf(line.quantity).setScale(3, RoundingMode.HALF_UP);
            BigDecimal stockBefore = BigDecimal.valueOf(item.stock).setScale(3, RoundingMode.HALF_UP);
            BigDecimal stockAfter = stockBefore.add(qtyToAdd).setScale(3, RoundingMode.HALF_UP);

            BigDecimal unitRate = (line.unitRate != null && line.unitRate >= 0.0)
                ? BigDecimal.valueOf(line.unitRate).setScale(2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
            BigDecimal lineTotal = (line.totalRate != null && line.totalRate >= 0.0)
                ? BigDecimal.valueOf(line.totalRate).setScale(2, RoundingMode.HALF_UP)
                : qtyToAdd.multiply(unitRate).setScale(2, RoundingMode.HALF_UP);

            // Update item stock in Central Inventory
            item.stock = stockAfter.doubleValue();
            item.updatedAt = LocalDateTime.now();
            itemRepo.save(item);

            String unit = (line.unit != null && !line.unit.isBlank()) ? line.unit.trim().toUpperCase() : item.unit;

            // Insert matching Inventory Transaction audit record
            InventoryTransaction tx = new InventoryTransaction(
                organisationId,
                item.name,
                item.category,
                unit,
                "RECEIPT",
                qtyToAdd.doubleValue(),
                "VENDOR_ENTRY",
                entry.id,
                stockAfter.doubleValue(),
                username,
                userId
            );
            tx.transactionDate = entryDateTime;
            tx = txRepo.save(tx);

            // Insert Vendor Inventory Entry Item record
            VendorInventoryEntryItem entryItem = new VendorInventoryEntryItem(
                entry.id,
                organisationId,
                item.id,
                item.name,
                unit,
                qtyToAdd.doubleValue(),
                stockBefore.doubleValue(),
                stockAfter.doubleValue(),
                unitRate.doubleValue(),
                lineTotal.doubleValue(),
                tx.id
            );
            entryItem.createdAt = entryDateTime;
            savedItems.add(entryItemRepo.save(entryItem));

            totalQty = totalQty.add(qtyToAdd);
            grandTotal = grandTotal.add(lineTotal);
        }

        // 6. Update Entry Header Totals
        entry.paymentMode = paymentMode;
        entry.totalItems = savedItems.size();
        entry.totalQuantity = totalQty.setScale(3, RoundingMode.HALF_UP).doubleValue();
        entry.grandTotal = grandTotal.setScale(2, RoundingMode.HALF_UP).doubleValue();
        entry.updatedAt = LocalDateTime.now();
        entry = entryRepo.save(entry);

        return toDto(entry, savedItems);
    }

    // -------------------------------------------------------------
    // ENTRY HISTORY & DETAILS
    // -------------------------------------------------------------

    public List<VendorEntryDto> getVendorEntries(Long organisationId, LocalDate fromDate, LocalDate toDate, String search) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }

        List<VendorInventoryEntry> entries;
        if (fromDate != null && toDate != null) {
            LocalDateTime startDt = fromDate.atStartOfDay();
            LocalDateTime endDt = toDate.atTime(LocalTime.MAX);
            entries = entryRepo.findByOrganisationIdAndDateRange(organisationId, fromDate, toDate, startDt, endDt);
        } else if (fromDate != null) {
            LocalDateTime startDt = fromDate.atStartOfDay();
            LocalDateTime endDt = fromDate.atTime(LocalTime.MAX);
            entries = entryRepo.findByOrganisationIdAndDateRange(organisationId, fromDate, fromDate, startDt, endDt);
        } else if (toDate != null) {
            LocalDate start = LocalDate.of(2000, 1, 1);
            LocalDateTime startDt = start.atStartOfDay();
            LocalDateTime endDt = toDate.atTime(LocalTime.MAX);
            entries = entryRepo.findByOrganisationIdAndDateRange(organisationId, start, toDate, startDt, endDt);
        } else {
            entries = entryRepo.findByOrganisationIdOrderByEntryDateTimeDesc(organisationId);
        }

        if (search != null && !search.isBlank()) {
            String q = search.trim().toLowerCase();
            entries = entries.stream()
                .filter(e -> (e.vendorName != null && e.vendorName.toLowerCase().contains(q)) ||
                             (e.entryNumber != null && e.entryNumber.toLowerCase().contains(q)) ||
                             (e.paymentMode != null && e.paymentMode.toLowerCase().contains(q)) ||
                             (e.receivedBy != null && e.receivedBy.toLowerCase().contains(q)) ||
                             (e.broughtBy != null && e.broughtBy.toLowerCase().contains(q)) ||
                             (e.remarks != null && e.remarks.toLowerCase().contains(q)))
                .collect(Collectors.toList());
        }

        if (entries.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> entryIds = entries.stream().map(e -> e.id).collect(Collectors.toList());
        List<VendorInventoryEntryItem> allItems = entryItemRepo.findByEntryIdIn(entryIds);
        Map<Long, List<VendorInventoryEntryItem>> itemsByEntry = allItems.stream()
            .collect(Collectors.groupingBy(i -> i.entryId));

        return entries.stream()
            .map(e -> toDto(e, itemsByEntry.getOrDefault(e.id, Collections.emptyList())))
            .collect(Collectors.toList());
    }

    public VendorEntryDto getEntryDetails(Long organisationId, Long entryId) {
        if (organisationId == null || entryId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID and Entry ID are required");
        }
        VendorInventoryEntry entry = entryRepo.findByIdAndOrganisationId(entryId, organisationId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor inventory entry not found"));
        List<VendorInventoryEntryItem> items = entryItemRepo.findByEntryIdOrderByIdAsc(entryId);
        return toDto(entry, items);
    }

    private VendorEntryDto toDto(VendorInventoryEntry e, List<VendorInventoryEntryItem> items) {
        VendorEntryDto dto = new VendorEntryDto(
            e.id,
            e.entryNumber,
            e.organisationId,
            e.branchId,
            e.vendorId,
            e.vendorName,
            e.entryDate,
            e.entryDateTime,
            e.status,
            e.remarks,
            e.clientSubmissionId,
            e.totalItems,
            e.totalQuantity,
            e.paymentMode != null ? e.paymentMode : "CASH",
            e.grandTotal != null ? e.grandTotal : 0.0,
            e.receivedBy,
            e.broughtBy,
            e.createdBy,
            e.createdByUserId,
            e.createdAt
        );
        if (items != null) {
            dto.items = items.stream().map(i -> new VendorEntryItemDto(
                i.id,
                i.entryId,
                i.itemId,
                i.itemName,
                i.unit,
                i.quantity,
                i.stockBefore,
                i.stockAfter,
                i.unitRate != null ? i.unitRate : 0.0,
                i.totalRate != null ? i.totalRate : 0.0,
                i.transactionId,
                i.createdAt
            )).collect(Collectors.toList());
        }
        return dto;
    }

    // -------------------------------------------------------------
    // CONSOLIDATED VENDOR REPORT (SUMMARY & DETAILS VIEW)
    // -------------------------------------------------------------

    public VendorEntryReportDto getVendorEntryReport(Long organisationId, LocalDate fromDate, LocalDate toDate, String search) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }

        LocalDate effectiveFrom = fromDate;
        LocalDate effectiveTo = toDate;
        if (effectiveFrom == null && effectiveTo == null) {
            effectiveFrom = LocalDate.now();
            effectiveTo = LocalDate.now();
        } else if (effectiveFrom != null && effectiveTo == null) {
            effectiveTo = effectiveFrom;
        } else if (effectiveFrom == null) {
            effectiveFrom = LocalDate.of(2000, 1, 1);
        }

        LocalDateTime startDt = effectiveFrom.atStartOfDay();
        LocalDateTime endDt = effectiveTo.atTime(LocalTime.MAX);
        List<VendorInventoryEntry> entries = entryRepo.findByOrganisationIdAndDateRange(organisationId, effectiveFrom, effectiveTo, startDt, endDt);

        VendorEntryReportDto report = new VendorEntryReportDto();
        report.fromDate = effectiveFrom.toString();
        report.toDate = effectiveTo.toString();

        if (entries.isEmpty()) {
            report.totalVendors = 0;
            report.grandTotalAmount = 0.0;
            report.grandTotalQuantityFormatted = "0";
            report.grandTotalQuantityByUnit = Collections.emptyMap();
            report.summaryRows = Collections.emptyList();
            report.detailsGroups = Collections.emptyList();
            return report;
        }

        List<Long> entryIds = entries.stream().map(e -> e.id).collect(Collectors.toList());
        List<VendorInventoryEntryItem> allItems = entryItemRepo.findByEntryIdIn(entryIds);
        Map<Long, List<VendorInventoryEntryItem>> itemsByEntry = allItems.stream()
                .collect(Collectors.groupingBy(i -> i.entryId));

        // Group entries by vendor
        Map<String, List<VendorInventoryEntry>> entriesByVendorKey = new LinkedHashMap<>();
        Map<String, String> vendorKeyToName = new HashMap<>();
        Map<String, Long> vendorKeyToId = new HashMap<>();

        for (VendorInventoryEntry e : entries) {
            String vName = e.vendorName != null ? e.vendorName.trim() : "Unknown Vendor";
            String key = e.vendorId != null ? ("ID_" + e.vendorId) : ("NAME_" + vName.toLowerCase());
            entriesByVendorKey.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
            vendorKeyToName.putIfAbsent(key, vName);
            if (e.vendorId != null) {
                vendorKeyToId.putIfAbsent(key, e.vendorId);
            }
        }

        String searchFilter = (search != null && !search.isBlank()) ? search.trim().toLowerCase() : null;

        List<VendorEntryReportDto.VendorSummaryRowDto> summaryRows = new ArrayList<>();
        List<VendorEntryReportDto.VendorDetailsGroupDto> detailsGroups = new ArrayList<>();

        Map<String, BigDecimal> grandUnitTotals = new LinkedHashMap<>();
        BigDecimal grandAmount = BigDecimal.ZERO;

        for (Map.Entry<String, List<VendorInventoryEntry>> vEntry : entriesByVendorKey.entrySet()) {
            String vKey = vEntry.getKey();
            List<VendorInventoryEntry> vEntries = vEntry.getValue();
            String vName = vendorKeyToName.getOrDefault(vKey, "Unknown Vendor");
            Long vId = vendorKeyToId.get(vKey);

            // Collect all items for this vendor across all entries in date range
            List<VendorInventoryEntryItem> vendorItems = new ArrayList<>();
            for (VendorInventoryEntry e : vEntries) {
                List<VendorInventoryEntryItem> iList = itemsByEntry.get(e.id);
                if (iList != null) {
                    vendorItems.addAll(iList);
                }
            }

            // Consolidate items by (itemId or itemName) + unit
            Map<String, List<VendorInventoryEntryItem>> itemsGrouped = new LinkedHashMap<>();
            for (VendorInventoryEntryItem item : vendorItems) {
                String cleanUnit = item.unit != null ? item.unit.trim().toUpperCase() : "";
                String itemKey;
                if (item.itemId != null && item.itemId > 0) {
                    itemKey = "ID_" + item.itemId + "___" + cleanUnit;
                } else {
                    String cleanName = item.itemName != null ? item.itemName.trim().toLowerCase() : "";
                    itemKey = "NAME_" + cleanName + "___" + cleanUnit;
                }
                itemsGrouped.computeIfAbsent(itemKey, k -> new ArrayList<>()).add(item);
            }

            List<VendorEntryReportDto.VendorConsolidatedItemDto> consolidatedItems = new ArrayList<>();
            Map<String, BigDecimal> vendorUnitTotals = new LinkedHashMap<>();
            BigDecimal vendorAmount = BigDecimal.ZERO;

            for (List<VendorInventoryEntryItem> group : itemsGrouped.values()) {
                if (group.isEmpty()) continue;
                VendorInventoryEntryItem first = group.get(0);
                String itemName = first.itemName != null ? first.itemName.trim() : "Unknown Item";
                String unit = first.unit != null ? first.unit.trim().toUpperCase() : "";
                Long itemId = first.itemId;

                BigDecimal sumQty = BigDecimal.ZERO;
                BigDecimal sumTotalRate = BigDecimal.ZERO;

                for (VendorInventoryEntryItem it : group) {
                    if (it.quantity != null) {
                        sumQty = sumQty.add(BigDecimal.valueOf(it.quantity));
                    }
                    if (it.totalRate != null) {
                        sumTotalRate = sumTotalRate.add(BigDecimal.valueOf(it.totalRate));
                    } else if (it.quantity != null && it.unitRate != null) {
                        sumTotalRate = sumTotalRate.add(BigDecimal.valueOf(it.quantity).multiply(BigDecimal.valueOf(it.unitRate)));
                    }
                }

                BigDecimal weightedUnitRate = BigDecimal.ZERO;
                if (sumQty.compareTo(BigDecimal.ZERO) > 0) {
                    weightedUnitRate = sumTotalRate.divide(sumQty, 2, RoundingMode.HALF_UP);
                }

                VendorEntryReportDto.VendorConsolidatedItemDto cItem = new VendorEntryReportDto.VendorConsolidatedItemDto();
                cItem.itemId = itemId;
                cItem.itemName = itemName;
                cItem.unit = unit;
                cItem.quantity = sumQty.setScale(3, RoundingMode.HALF_UP).doubleValue();
                cItem.unitRate = weightedUnitRate.doubleValue();
                cItem.totalRate = sumTotalRate.setScale(2, RoundingMode.HALF_UP).doubleValue();

                boolean matchesFilter = true;
                if (searchFilter != null) {
                    boolean vendorMatch = vName.toLowerCase().contains(searchFilter);
                    boolean itemMatch = itemName.toLowerCase().contains(searchFilter);
                    matchesFilter = vendorMatch || itemMatch;
                }

                if (matchesFilter) {
                    consolidatedItems.add(cItem);
                    vendorAmount = vendorAmount.add(sumTotalRate);
                    vendorUnitTotals.merge(unit, sumQty, BigDecimal::add);
                }
            }

            if (searchFilter != null && consolidatedItems.isEmpty() && !vName.toLowerCase().contains(searchFilter)) {
                continue;
            }

            consolidatedItems.sort(Comparator.comparing(a -> a.itemName != null ? a.itemName.toLowerCase() : ""));

            String vendorQtyFormatted = formatUnitTotals(vendorUnitTotals);

            VendorEntryReportDto.VendorDetailsGroupDto detailsGroup = new VendorEntryReportDto.VendorDetailsGroupDto();
            detailsGroup.vendorId = vId;
            detailsGroup.vendorName = vName;
            detailsGroup.items = consolidatedItems;
            detailsGroup.subtotalAmount = vendorAmount.setScale(2, RoundingMode.HALF_UP).doubleValue();
            detailsGroup.subtotalQuantityFormatted = vendorQtyFormatted;
            detailsGroup.subtotalQuantityByUnit = toDoubleMap(vendorUnitTotals);
            detailsGroup.entryCount = vEntries.size();
            detailsGroups.add(detailsGroup);

            VendorEntryReportDto.VendorSummaryRowDto summaryRow = new VendorEntryReportDto.VendorSummaryRowDto();
            summaryRow.vendorId = vId;
            summaryRow.vendorName = vName;
            summaryRow.totalRate = vendorAmount.setScale(2, RoundingMode.HALF_UP).doubleValue();
            summaryRow.totalQuantityFormatted = vendorQtyFormatted;
            summaryRow.quantityByUnit = toDoubleMap(vendorUnitTotals);
            summaryRow.entryCount = vEntries.size();
            summaryRow.itemCount = consolidatedItems.size();
            summaryRows.add(summaryRow);

            grandAmount = grandAmount.add(vendorAmount);
            for (Map.Entry<String, BigDecimal> uEntry : vendorUnitTotals.entrySet()) {
                grandUnitTotals.merge(uEntry.getKey(), uEntry.getValue(), BigDecimal::add);
            }
        }

        summaryRows.sort(Comparator.comparing(a -> a.vendorName != null ? a.vendorName.toLowerCase() : ""));
        detailsGroups.sort(Comparator.comparing(a -> a.vendorName != null ? a.vendorName.toLowerCase() : ""));

        report.totalVendors = summaryRows.size();
        report.grandTotalAmount = grandAmount.setScale(2, RoundingMode.HALF_UP).doubleValue();
        report.grandTotalQuantityFormatted = formatUnitTotals(grandUnitTotals);
        report.grandTotalQuantityByUnit = toDoubleMap(grandUnitTotals);
        report.summaryRows = summaryRows;
        report.detailsGroups = detailsGroups;

        return report;
    }

    private String formatUnitTotals(Map<String, BigDecimal> totals) {
        if (totals == null || totals.isEmpty()) {
            return "0";
        }
        return totals.entrySet().stream()
                .map(e -> {
                    BigDecimal qty = e.getValue().setScale(3, RoundingMode.HALF_UP).stripTrailingZeros();
                    String qtyStr = qty.scale() <= 0 ? qty.toPlainString() : qty.toPlainString();
                    String unit = e.getKey();
                    return unit != null && !unit.isBlank() ? (qtyStr + " " + unit) : qtyStr;
                })
                .collect(Collectors.joining(", "));
    }

    private Map<String, Double> toDoubleMap(Map<String, BigDecimal> source) {
        if (source == null) return Collections.emptyMap();
        Map<String, Double> result = new LinkedHashMap<>();
        for (Map.Entry<String, BigDecimal> e : source.entrySet()) {
            result.put(e.getKey(), e.getValue().setScale(3, RoundingMode.HALF_UP).doubleValue());
        }
        return result;
    }
}

