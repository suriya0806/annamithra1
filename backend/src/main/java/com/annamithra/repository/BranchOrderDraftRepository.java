package com.annamithra.repository;

import com.annamithra.model.BranchOrderDraft;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BranchOrderDraftRepository extends JpaRepository<BranchOrderDraft, Long> {
    List<BranchOrderDraft> findByOrganisationIdAndBranchNameIgnoreCaseOrderByUpdatedAtDesc(Long organisationId, String branchName);

    List<BranchOrderDraft> findByBranchNameIgnoreCaseOrderByUpdatedAtDesc(String branchName);

    Optional<BranchOrderDraft> findByIdAndOrganisationId(Long id, Long organisationId);
}
