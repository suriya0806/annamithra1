package com.annamithra.service;

import com.annamithra.model.Department;
import com.annamithra.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class DepartmentService {

    private final DepartmentRepository departmentRepository;

    public DepartmentService(DepartmentRepository departmentRepository) {
        this.departmentRepository = departmentRepository;
    }

    public List<Department> getDepartments(Long organisationId) {
        if (organisationId == null) {
            return departmentRepository.findByOrganisationIdAndActiveTrueOrderByNameAsc(1L);
        }
        List<Department> list = departmentRepository.findByOrganisationIdAndActiveTrueOrderByNameAsc(organisationId);
        if (list.isEmpty() && !organisationId.equals(1L)) {
            // Fallback to default organisation departments if not yet explicitly seeded
            list = departmentRepository.findByOrganisationIdAndActiveTrueOrderByNameAsc(1L);
        }
        return list;
    }

    public boolean isValidDepartment(Long organisationId, String departmentName) {
        if (departmentName == null || departmentName.trim().isBlank()) {
            return false;
        }
        String cleanName = departmentName.trim();
        Long org = (organisationId != null) ? organisationId : 1L;
        Optional<Department> opt = departmentRepository.findByOrganisationIdAndNameIgnoreCase(org, cleanName);
        if (opt.isPresent() && opt.get().active) {
            return true;
        }
        // Fallback check against default organisation (1)
        if (!org.equals(1L)) {
            Optional<Department> optDefault = departmentRepository.findByOrganisationIdAndNameIgnoreCase(1L, cleanName);
            if (optDefault.isPresent() && optDefault.get().active) {
                return true;
            }
        }
        return false;
    }

    @Transactional
    public Department ensureDepartment(Long organisationId, String name, String createdBy) {
        if (name == null || name.trim().isBlank()) return null;
        String cleanName = name.trim();
        Long org = (organisationId != null) ? organisationId : 1L;
        Optional<Department> existing = departmentRepository.findByOrganisationIdAndNameIgnoreCase(org, cleanName);
        if (existing.isPresent()) {
            Department d = existing.get();
            if (!d.active) {
                d.active = true;
                d.updatedAt = LocalDateTime.now();
                return departmentRepository.save(d);
            }
            return d;
        }
        Department d = new Department(org, cleanName, createdBy != null ? createdBy : "System");
        return departmentRepository.save(d);
    }
}

