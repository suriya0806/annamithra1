package com.annamithra.repository;

import com.annamithra.model.DispatchReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DispatchReturnRepository extends JpaRepository<DispatchReturn, Long> {
    List<DispatchReturn> findByDispatchIdOrderByReturnDateDesc(Long dispatchId);
    List<DispatchReturn> findByBranchNameIgnoreCaseOrderByReturnDateDesc(String branchName);
    List<DispatchReturn> findAllByOrderByReturnDateDesc();
    List<DispatchReturn> findByOrganisationIdOrderByReturnDateDesc(Long organisationId);
}
