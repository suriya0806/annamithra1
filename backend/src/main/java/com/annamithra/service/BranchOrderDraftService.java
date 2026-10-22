package com.annamithra.service;

import com.annamithra.dto.BranchOrderDraftDto.*;
import com.annamithra.model.BranchOrderDraft;
import com.annamithra.repository.BranchOrderDraftRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@SuppressWarnings("null")
public class BranchOrderDraftService {
    private final BranchOrderDraftRepository draftRepo;
    private final ObjectMapper objectMapper;

    public BranchOrderDraftService(BranchOrderDraftRepository draftRepo, ObjectMapper objectMapper) {
        this.draftRepo = draftRepo;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public DraftResponse createDraft(SaveDraftRequest req, String branchName, Long branchId, Long orgId, String username) {
        if (branchName == null || branchName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch name is required to save a draft");
        }

        List<DraftItemLine> validItems = validateAndCleanItems(req != null ? req.items : null);
        if (validItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot save an empty draft. Please add at least one item with quantity > 0");
        }

        int itemCount = validItems.size();
        int totalQuantity = validItems.stream().mapToInt(it -> it.requestedQuantity).sum();
        String json = serializeItems(validItems);

        String draftName = (req != null && req.draftName != null && !req.draftName.isBlank())
            ? req.draftName.trim()
            : generateDefaultDraftName(branchName, orgId);

        BranchOrderDraft draft = new BranchOrderDraft(
            orgId,
            branchId,
            branchName.trim(),
            draftName,
            "DRAFT",
            itemCount,
            totalQuantity,
            json,
            username != null ? username : "Branch Manager"
        );

        BranchOrderDraft saved = draftRepo.save(draft);
        return toResponse(saved, validItems);
    }

    @Transactional(readOnly = true)
    public List<DraftResponse> getDraftsByBranch(String branchName, Long orgId) {
        if (branchName == null || branchName.isBlank()) {
            return new ArrayList<>();
        }

        List<BranchOrderDraft> drafts = (orgId != null)
            ? draftRepo.findByOrganisationIdAndBranchNameIgnoreCaseOrderByUpdatedAtDesc(orgId, branchName.trim())
            : draftRepo.findByBranchNameIgnoreCaseOrderByUpdatedAtDesc(branchName.trim());

        return drafts.stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DraftResponse getDraftById(Long id, String branchName, Long orgId) {
        BranchOrderDraft draft = draftRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Draft not found with ID: " + id));

        validateDraftAccess(draft, branchName, orgId);
        return toResponse(draft);
    }

    @Transactional
    public DraftResponse updateDraft(Long id, SaveDraftRequest req, String branchName, Long orgId, String username) {
        BranchOrderDraft draft = draftRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Draft not found with ID: " + id));

        validateDraftAccess(draft, branchName, orgId);

        List<DraftItemLine> validItems = validateAndCleanItems(req != null ? req.items : null);
        if (validItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot save an empty draft. Please keep at least one item with quantity > 0");
        }

        if (req != null && req.draftName != null && !req.draftName.isBlank()) {
            draft.draftName = req.draftName.trim();
        }

        draft.itemCount = validItems.size();
        draft.totalQuantity = validItems.stream().mapToInt(it -> it.requestedQuantity).sum();
        draft.itemsJson = serializeItems(validItems);
        draft.updatedAt = LocalDateTime.now();

        BranchOrderDraft updated = draftRepo.save(draft);
        return toResponse(updated, validItems);
    }

    @Transactional
    public void deleteDraft(Long id, String branchName, Long orgId) {
        BranchOrderDraft draft = draftRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Draft not found with ID: " + id));

        validateDraftAccess(draft, branchName, orgId);
        draftRepo.delete(draft);
    }

    @Transactional
    public DraftResponse markMovedToOrder(Long id, String branchName, Long orgId) {
        BranchOrderDraft draft = draftRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Draft not found with ID: " + id));

        validateDraftAccess(draft, branchName, orgId);
        draft.status = "MOVED_TO_ORDER";
        draft.updatedAt = LocalDateTime.now();
        BranchOrderDraft saved = draftRepo.save(draft);
        return toResponse(saved);
    }

    private void validateDraftAccess(BranchOrderDraft draft, String branchName, Long orgId) {
        if (orgId != null && draft.organisationId != null && !orgId.equals(draft.organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Draft belongs to a different organisation");
        }
        if (branchName != null && !branchName.isBlank()) {
            if (!draft.branchName.equalsIgnoreCase(branchName.trim())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You can only view and manage drafts for " + branchName);
            }
        }
    }

    private List<DraftItemLine> validateAndCleanItems(List<DraftItemLine> items) {
        List<DraftItemLine> result = new ArrayList<>();
        if (items == null) return result;

        for (DraftItemLine line : items) {
            if (line == null) continue;
            String itemName = line.itemName != null ? line.itemName.trim() : "";
            if (itemName.isEmpty()) continue;
            if (line.requestedQuantity <= 0) continue;

            String unit = line.unit != null && !line.unit.isBlank() ? line.unit.trim().toUpperCase() : "KG";
            String category = line.category != null && !line.category.isBlank() ? line.category.trim() : "General";

            result.add(new DraftItemLine(itemName, unit, category, line.requestedQuantity, line.isNewItem));
        }
        return result;
    }

    private String serializeItems(List<DraftItemLine> items) {
        try {
            return objectMapper.writeValueAsString(items);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize draft items", e);
        }
    }

    private List<DraftItemLine> deserializeItems(String json) {
        if (json == null || json.isBlank() || json.equals("[]")) {
            return new ArrayList<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<DraftItemLine>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String generateDefaultDraftName(String branchName, Long orgId) {
        long count = (orgId != null)
            ? draftRepo.findByOrganisationIdAndBranchNameIgnoreCaseOrderByUpdatedAtDesc(orgId, branchName).size()
            : draftRepo.findByBranchNameIgnoreCaseOrderByUpdatedAtDesc(branchName).size();
        return "Draft #" + (count + 1) + " (" + LocalDate.now() + ")";
    }

    private DraftResponse toResponse(BranchOrderDraft draft) {
        return toResponse(draft, deserializeItems(draft.itemsJson));
    }

    private DraftResponse toResponse(BranchOrderDraft draft, List<DraftItemLine> items) {
        DraftResponse res = new DraftResponse();
        res.id = draft.id;
        res.organisationId = draft.organisationId;
        res.branchId = draft.branchId;
        res.branchName = draft.branchName;
        res.draftName = draft.draftName;
        res.status = draft.status;
        res.itemCount = draft.itemCount;
        res.totalQuantity = draft.totalQuantity;
        res.items = items;
        res.createdAt = draft.createdAt;
        res.updatedAt = draft.updatedAt;
        res.createdBy = draft.createdBy;
        return res;
    }
}
