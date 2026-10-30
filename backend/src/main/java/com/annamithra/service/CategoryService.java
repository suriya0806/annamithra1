package com.annamithra.service;

import com.annamithra.dto.CreateCategoryRequest;
import com.annamithra.dto.UpdateCategoryRequest;
import com.annamithra.model.Item;
import com.annamithra.model.ItemCategory;
import com.annamithra.repository.ItemCategoryRepository;
import com.annamithra.repository.ItemRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class CategoryService {
    private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

    private final ItemCategoryRepository categoryRepo;
    private final ItemRepository itemRepo;

    public CategoryService(ItemCategoryRepository categoryRepo, ItemRepository itemRepo) {
        this.categoryRepo = categoryRepo;
        this.itemRepo = itemRepo;
    }

    public List<ItemCategory> getCategories(Long organisationId, boolean includeInactive) {
        if (organisationId != null) {
            return includeInactive
                    ? categoryRepo.findByOrganisationIdOrderByNameAsc(organisationId)
                    : categoryRepo.findByOrganisationIdAndActiveTrueOrderByNameAsc(organisationId);
        }
        return includeInactive
                ? categoryRepo.findAllByOrderByNameAsc()
                : categoryRepo.findAllByActiveTrueOrderByNameAsc();
    }

    @Transactional
    public ItemCategory createCategory(CreateCategoryRequest req, Long organisationId, String username) {
        if (req == null || req.name == null || req.name.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category name is required");
        }

        String cleanedName = req.name.trim();

        // Prevent duplicate category names within the relevant organisation (case-insensitive)
        Optional<ItemCategory> existing = (organisationId != null)
                ? categoryRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, cleanedName)
                : categoryRepo.findByNameIgnoreCase(cleanedName);

        if (existing.isPresent()) {
            ItemCategory ex = existing.get();
            if (!ex.active) {
                // Reactivate if it was previously deactivated
                ex.active = true;
                ex.updatedAt = LocalDateTime.now();
                return categoryRepo.save(ex);
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Category already exists.");
        }

        ItemCategory newCat = new ItemCategory(organisationId, cleanedName, username);
        return categoryRepo.save(newCat);
    }

    @Transactional
    public ItemCategory updateCategory(Long id, UpdateCategoryRequest req, Long organisationId, String username) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category ID is required");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }

        ItemCategory cat = categoryRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        if (organisationId != null && cat.organisationId != null && !cat.organisationId.equals(organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot modify another organisation's category");
        }

        String oldName = cat.name;

        if (req.name != null && !req.name.trim().isEmpty()) {
            String newName = req.name.trim();
            if (!newName.equalsIgnoreCase(oldName)) {
                // Prevent duplicate category names within organisation
                Optional<ItemCategory> duplicate = (organisationId != null)
                        ? categoryRepo.findByOrganisationIdAndNameIgnoreCaseAndIdNot(organisationId, newName, id)
                        : categoryRepo.findByNameIgnoreCase(newName).filter(c -> !c.id.equals(id));

                if (duplicate.isPresent()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Category already exists.");
                }
            }

            cat.name = newName;

            if (!newName.equals(oldName)) {
                // Cascade rename to all existing items referencing this category
                // This ensures existing items retain their category relationship and name everywhere
                List<Item> linkedItems = (organisationId != null)
                        ? itemRepo.findByOrganisationIdAndCategoryId(organisationId, id)
                        : itemRepo.findByCategoryId(id);

                for (Item item : linkedItems) {
                    item.category = newName;
                    item.updatedAt = LocalDateTime.now();
                    itemRepo.save(item);
                }

                // Also update any legacy items matching old name without categoryId set
                if (oldName != null && !oldName.isBlank()) {
                    List<Item> legacyItems = (organisationId != null)
                            ? itemRepo.findByOrganisationIdAndCategoryIgnoreCase(organisationId, oldName)
                            : itemRepo.findAll().stream().filter(i -> oldName.equalsIgnoreCase(i.category)).toList();
                    for (Item item : legacyItems) {
                        item.category = newName;
                        item.categoryId = cat.id;
                        item.updatedAt = LocalDateTime.now();
                        itemRepo.save(item);
                    }
                }
            }
        }

        if (req.active != null) {
            cat.active = req.active;
        }

        cat.updatedAt = LocalDateTime.now();
        return categoryRepo.save(cat);
    }

    @Transactional
    public boolean deleteCategory(Long id, Long organisationId) {
        return deleteCategory(id, organisationId, false);
    }

    @Transactional
    public boolean deleteCategory(Long id, Long organisationId, boolean force) {
        ItemCategory cat = categoryRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        if (organisationId != null && cat.organisationId != null && !cat.organisationId.equals(organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot delete another organisation's category");
        }

        long inUseCount = (organisationId != null)
                ? itemRepo.countByOrganisationIdAndCategoryId(organisationId, id)
                : itemRepo.countByCategoryId(id);

        if (cat.name != null && !cat.name.isBlank()) {
            long byNameCount = (organisationId != null)
                    ? itemRepo.findByOrganisationIdAndCategoryIgnoreCase(organisationId, cat.name.trim()).size()
                    : itemRepo.findAll().stream().filter(i -> cat.name.trim().equalsIgnoreCase(i.category)).count();
            inUseCount = Math.max(inUseCount, byNameCount);
        }

        if (force) {
            // Unlink any items referencing this category ID to prevent foreign key errors
            List<Item> linkedItems = (organisationId != null)
                    ? itemRepo.findByOrganisationIdAndCategoryId(organisationId, id)
                    : itemRepo.findByCategoryId(id);
            for (Item item : linkedItems) {
                item.categoryId = null;
                item.updatedAt = LocalDateTime.now();
                itemRepo.save(item);
            }
            categoryRepo.delete(cat);
            log.info("Category ID {} permanently deleted with force (unlinked from {} items).", id, linkedItems.size());
            return false;
        }

        if (inUseCount > 0) {
            // Requirement: "Prefer deactivation over destructive deletion when a category is already in use."
            cat.active = false;
            cat.updatedAt = LocalDateTime.now();
            categoryRepo.save(cat);
            log.info("Category ID {} is in use by {} item(s); deactivated instead of deleted.", id, inUseCount);
            return true;
        } else {
            categoryRepo.delete(cat);
            log.info("Category ID {} deleted successfully.", id);
            return false;
        }
    }
}
