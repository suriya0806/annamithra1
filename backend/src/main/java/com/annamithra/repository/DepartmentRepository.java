package com.annamithra.repository;

import com.annamithra.model.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<Department, Long> {
    List<Department> findByOrganisationIdAndActiveTrueOrderByNameAsc(Long organisationId);
    List<Department> findByOrganisationIdOrderByNameAsc(Long organisationId);
    List<Department> findAllByActiveTrueOrderByNameAsc();
    List<Department> findAllByOrderByNameAsc();
    Optional<Department> findByOrganisationIdAndNameIgnoreCase(Long organisationId, String name);
    Optional<Department> findByNameIgnoreCase(String name);
    Optional<Department> findByOrganisationIdAndNameIgnoreCaseAndIdNot(Long organisationId, String name, Long id);
}

