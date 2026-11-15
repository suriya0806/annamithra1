package com.annamithra.repository;

import com.annamithra.model.VendorInventoryEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface VendorInventoryEntryRepository extends JpaRepository<VendorInventoryEntry, Long> {
    Optional<VendorInventoryEntry> findByOrganisationIdAndClientSubmissionId(Long organisationId, String clientSubmissionId);
    List<VendorInventoryEntry> findByOrganisationIdAndEntryDateBetweenOrderByEntryDateTimeDesc(Long organisationId, LocalDate start, LocalDate end);
    List<VendorInventoryEntry> findByOrganisationIdOrderByEntryDateTimeDesc(Long organisationId);
    Optional<VendorInventoryEntry> findByIdAndOrganisationId(Long id, Long organisationId);
    long countByOrganisationId(Long organisationId);

    @Query("SELECT e FROM VendorInventoryEntry e WHERE e.organisationId = :organisationId " +
           "AND ((e.entryDate >= :start AND e.entryDate <= :end) OR (e.entryDateTime >= :startDt AND e.entryDateTime <= :endDt)) " +
           "ORDER BY e.entryDateTime DESC, e.id DESC")
    List<VendorInventoryEntry> findByOrganisationIdAndDateRange(
        @Param("organisationId") Long organisationId,
        @Param("start") LocalDate start,
        @Param("end") LocalDate end,
        @Param("startDt") LocalDateTime startDt,
        @Param("endDt") LocalDateTime endDt);
}

