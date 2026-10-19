package com.annamithra.repository;

import com.annamithra.model.Dispatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

public interface DispatchRepository extends JpaRepository<Dispatch, Long> {
    List<Dispatch> findAllByOrderByCreatedAtDesc();
    List<Dispatch> findByOrganisationIdOrderByCreatedAtDesc(Long organisationId);

    List<Dispatch> findByBranchNameIgnoreCaseOrderByCreatedAtDesc(String branchName);
    List<Dispatch> findByOrganisationIdAndBranchNameIgnoreCaseOrderByCreatedAtDesc(Long organisationId, String branchName);

    List<Dispatch> findByBranchNameIgnoreCaseAndStatusIgnoreCaseOrderByCreatedAtDesc(String branchName, String status);
    List<Dispatch> findByOrganisationIdAndBranchNameIgnoreCaseAndStatusIgnoreCaseOrderByCreatedAtDesc(Long organisationId, String branchName, String status);

    List<Dispatch> findByRequestIdIn(List<Long> requestIds);
    List<Dispatch> findByOrganisationIdAndRequestIdIn(Long organisationId, List<Long> requestIds);

    @Query("SELECT d FROM Dispatch d WHERE (:branch IS NULL OR :branch = '' OR LOWER(d.branchName) = LOWER(:branch)) AND (:date IS NULL OR d.dispatchDate = :date) AND (:item IS NULL OR LOWER(d.itemName) LIKE LOWER(CONCAT('%', :item, '%'))) ORDER BY d.createdAt DESC")
    List<Dispatch> searchDispatches(String branch, LocalDate date, String item);

    @Query("SELECT d FROM Dispatch d WHERE d.organisationId = :orgId AND (:branch IS NULL OR :branch = '' OR LOWER(d.branchName) = LOWER(:branch)) AND (:date IS NULL OR d.dispatchDate = :date) AND (:item IS NULL OR LOWER(d.itemName) LIKE LOWER(CONCAT('%', :item, '%'))) ORDER BY d.createdAt DESC")
    List<Dispatch> searchDispatchesByOrganisationId(Long orgId, String branch, LocalDate date, String item);

    @Query("SELECT d FROM Dispatch d WHERE LOWER(d.branchName) = LOWER(:branch) AND d.status = 'ACKNOWLEDGED' AND (:date IS NULL OR d.dispatchDate = :date) AND (:item IS NULL OR LOWER(d.itemName) LIKE LOWER(CONCAT('%', :item, '%'))) ORDER BY d.createdAt DESC")
    List<Dispatch> searchBranchReceivedHistory(String branch, LocalDate date, String item);

    @Query("SELECT d FROM Dispatch d WHERE d.organisationId = :orgId AND LOWER(d.branchName) = LOWER(:branch) AND d.status = 'ACKNOWLEDGED' AND (:date IS NULL OR d.dispatchDate = :date) AND (:item IS NULL OR LOWER(d.itemName) LIKE LOWER(CONCAT('%', :item, '%'))) ORDER BY d.createdAt DESC")
    List<Dispatch> searchBranchReceivedHistoryByOrganisationId(Long orgId, String branch, LocalDate date, String item);

    int countByOrganisationId(Long organisationId);
}
