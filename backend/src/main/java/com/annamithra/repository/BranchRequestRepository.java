package com.annamithra.repository;

import com.annamithra.model.BranchRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface BranchRequestRepository extends JpaRepository<BranchRequest, Long> {
    List<BranchRequest> findAllByOrderByCreatedAtDesc();
    List<BranchRequest> findByOrganisationIdOrderByCreatedAtDesc(Long organisationId);

    List<BranchRequest> findByBranchOrderByCreatedAtDesc(String branch);
    List<BranchRequest> findByOrganisationIdAndBranchOrderByCreatedAtDesc(Long organisationId, String branch);

    List<BranchRequest> findByBranchAndStatusNotOrderByCreatedAtDesc(String branch, String status);
    List<BranchRequest> findByOrganisationIdAndBranchAndStatusNotOrderByCreatedAtDesc(Long organisationId, String branch, String status);

    @Query("SELECT r FROM BranchRequest r WHERE LOWER(r.branch) = LOWER(?1) AND r.requested > r.dispatched ORDER BY r.id ASC")
    List<BranchRequest> findOutstandingForBranch(String branch);

    @Query("SELECT r FROM BranchRequest r WHERE r.organisationId = ?1 AND LOWER(r.branch) = LOWER(?2) AND r.requested > r.dispatched ORDER BY r.id ASC")
    List<BranchRequest> findOutstandingForOrganisationAndBranch(Long organisationId, String branch);

    @Query("SELECT r FROM BranchRequest r WHERE LOWER(r.branch) = LOWER(?1) AND LOWER(r.item) = LOWER(?2) AND r.requested > r.dispatched ORDER BY r.id ASC")
    List<BranchRequest> findOutstandingForBranchAndItem(String branch, String item);

    @Query("SELECT r FROM BranchRequest r WHERE r.organisationId = ?1 AND LOWER(r.branch) = LOWER(?2) AND LOWER(r.item) = LOWER(?3) AND r.requested > r.dispatched ORDER BY r.id ASC")
    List<BranchRequest> findOutstandingForOrganisationAndBranchAndItem(Long organisationId, String branch, String item);

    @Query("SELECT r FROM BranchRequest r WHERE r.requested > r.dispatched")
    List<BranchRequest> findAllOutstanding();

    @Query("SELECT r FROM BranchRequest r WHERE r.organisationId = ?1 AND r.requested > r.dispatched")
    List<BranchRequest> findAllOutstandingByOrganisationId(Long organisationId);

    int countByOrganisationId(Long organisationId);
}
