package com.annamithra.repository;

import com.annamithra.model.VendorInventoryEntryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VendorInventoryEntryItemRepository extends JpaRepository<VendorInventoryEntryItem, Long> {
    List<VendorInventoryEntryItem> findByEntryIdOrderByIdAsc(Long entryId);
    List<VendorInventoryEntryItem> findByEntryIdIn(List<Long> entryIds);
}

