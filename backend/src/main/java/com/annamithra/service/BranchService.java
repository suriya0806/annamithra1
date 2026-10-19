package com.annamithra.service;

import com.annamithra.dto.BranchManagerMappingDto;
import com.annamithra.dto.CreateBranchRequest;
import com.annamithra.model.AppUser;
import com.annamithra.model.Branch;
import com.annamithra.repository.BranchRepository;
import com.annamithra.repository.UserRepository;
import com.annamithra.security.PasswordUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Service
public class BranchService {
    private final BranchRepository branchRepo;
    private final UserRepository userRepo;

    public BranchService(BranchRepository branchRepo, UserRepository userRepo) {
        this.branchRepo = branchRepo;
        this.userRepo = userRepo;
    }

    public List<Branch> getAllBranches() {
        return branchRepo.findAllByOrderByIdAsc();
    }

    public List<Branch> getBranchesByOrganisation(Long organisationId) {
        if (organisationId == null) {
            return getAllBranches();
        }
        return branchRepo.findByOrganisationIdOrderByIdAsc(organisationId);
    }

    @Transactional
    public Branch createBranch(CreateBranchRequest req) {
        return createBranch(req, 1L);
    }

    @Transactional
    public Branch createBranch(CreateBranchRequest req, Long organisationId) {
        if (req.name == null || req.name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch name is required");
        }
        if (req.location == null || req.location.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch location is required");
        }
        if (req.managerUsername == null || req.managerUsername.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch Manager User ID is required");
        }
        if (req.managerPassword == null || req.managerPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch Manager Password is required");
        }

        String branchName = req.name.trim();
        String managerUsername = req.managerUsername.trim();

        if (organisationId != null) {
            if (branchRepo.findByOrganisationIdAndNameIgnoreCase(organisationId, branchName).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A branch with this name already exists in this organisation");
            }
        } else {
            if (branchRepo.findByNameIgnoreCase(branchName).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "A branch with this name already exists");
            }
        }

        if (userRepo.findByUsernameIgnoreCase(managerUsername).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with this Manager User ID already exists");
        }

        // 1. Create and save branch
        Branch branch = new Branch(branchName, req.location.trim(), organisationId, managerUsername, req.contact != null ? req.contact.trim() : "");
        branch = branchRepo.save(branch);

        // 2. Create and save Branch Manager user account linked to this branch & organisation
        String passwordHash = PasswordUtils.hashPassword(req.managerPassword);
        AppUser managerUser = new AppUser(
            managerUsername,
            passwordHash,
            "Branch Manager",
            organisationId,
            branch.id,
            branch.name,
            branch.name + " Manager"
        );
        userRepo.save(managerUser);

        return branch;
    }

    public List<BranchManagerMappingDto> getBranchManagerMappings() {
        return getBranchManagerMappings(null);
    }

    public List<BranchManagerMappingDto> getBranchManagerMappings(Long organisationId) {
        List<Branch> branches;
        if (organisationId != null) {
            branches = branchRepo.findByOrganisationIdOrderByIdAsc(organisationId);
        } else {
            branches = branchRepo.findAllByOrderByIdAsc();
        }

        List<BranchManagerMappingDto> list = new ArrayList<>();
        for (Branch b : branches) {
            list.add(new BranchManagerMappingDto(
                b.id,
                b.name,
                b.location,
                b.manager != null ? b.manager : "Unassigned",
                b.contact,
                b.createdAt
            ));
        }
        return list;
    }
}
