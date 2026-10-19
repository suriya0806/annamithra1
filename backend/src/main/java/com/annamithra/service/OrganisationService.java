package com.annamithra.service;

import com.annamithra.dto.CreateOrganisationRequest;
import com.annamithra.dto.CreateStoreManagerRequest;
import com.annamithra.dto.OrganisationSummaryDto;
import com.annamithra.dto.StoreManagerAccountDto;
import com.annamithra.model.AppUser;
import com.annamithra.model.Organisation;
import com.annamithra.repository.*;
import com.annamithra.security.PasswordUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class OrganisationService {
    private final OrganisationRepository orgRepo;
    private final UserRepository userRepo;
    private final BranchRepository branchRepo;
    private final ItemRepository itemRepo;
    private final PurchaseOrderRepository poRepo;

    public OrganisationService(OrganisationRepository orgRepo, UserRepository userRepo,
                               BranchRepository branchRepo, ItemRepository itemRepo,
                               PurchaseOrderRepository poRepo) {
        this.orgRepo = orgRepo;
        this.userRepo = userRepo;
        this.branchRepo = branchRepo;
        this.itemRepo = itemRepo;
        this.poRepo = poRepo;
    }

    public List<OrganisationSummaryDto> getAllOrganisations(String search) {
        List<Organisation> orgs;
        if (search != null && !search.isBlank()) {
            String q = search.trim();
            orgs = orgRepo.findByNameContainingIgnoreCaseOrCodeContainingIgnoreCaseOrderByIdAsc(q, q);
        } else {
            orgs = orgRepo.findAllByOrderByIdAsc();
        }

        List<OrganisationSummaryDto> result = new ArrayList<>();
        for (Organisation org : orgs) {
            result.add(toSummaryDto(org));
        }
        return result;
    }

    public OrganisationSummaryDto getOrganisationById(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }
        Organisation org = orgRepo.findById(java.util.Objects.requireNonNull(id))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organisation not found"));
        return toSummaryDto(org);
    }

    @Transactional
    public OrganisationSummaryDto createOrganisation(CreateOrganisationRequest req) {
        if (req.name == null || req.name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation Name is required");
        }
        if (req.code == null || req.code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation Code is required");
        }
        if (req.adminName == null || req.adminName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation Admin Name is required");
        }
        if (req.adminEmail == null || req.adminEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation Admin Email / User ID is required");
        }
        String rawPassword = (req.adminPassword != null && !req.adminPassword.isBlank()) 
            ? req.adminPassword.trim() 
            : (req.password != null ? req.password.trim() : null);
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Initial Admin Password is required");
        }

        String orgName = req.name.trim();
        String orgCode = req.code.trim().toUpperCase().replaceAll("\\s+", "_");
        String adminEmail = req.adminEmail.trim();

        if (orgRepo.findByCodeIgnoreCase(orgCode).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Organisation Code '" + orgCode + "' is already in use");
        }
        if (userRepo.findByUsernameIgnoreCase(adminEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User ID / Email '" + adminEmail + "' is already registered");
        }

        // 1. Create Organisation
        Organisation org = new Organisation(
            orgName,
            orgCode,
            req.adminName.trim(),
            adminEmail,
            req.contactPhone != null ? req.contactPhone.trim() : null,
            req.address != null ? req.address.trim() : null
        );
        org = orgRepo.save(org);

        // 2. Create Organisation Admin user
        String passwordHash = PasswordUtils.hashPassword(rawPassword);
        AppUser adminUser = new AppUser(
            adminEmail,
            passwordHash,
            "Organisation Admin",
            org.id,
            null,
            null,
            req.adminName.trim()
        );
        userRepo.save(adminUser);

        return toSummaryDto(org);
    }

    @Transactional
    public OrganisationSummaryDto setOrganisationStatus(Long id, String status) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }
        if (status == null || (!status.equalsIgnoreCase("ACTIVE") && !status.equalsIgnoreCase("INACTIVE"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be ACTIVE or INACTIVE");
        }
        Organisation org = orgRepo.findById(java.util.Objects.requireNonNull(id))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Organisation not found"));

        org.status = status.toUpperCase();
        org.updatedAt = LocalDateTime.now();
        org = orgRepo.save(org);

        return toSummaryDto(org);
    }

    public StoreManagerAccountDto getStoreManager(Long organisationId) {
        AppUser user = userRepo.findFirstByOrganisationIdAndRoleIgnoreCase(organisationId, "Store Manager")
            .orElse(null);
        if (user == null) {
            return null;
        }
        return new StoreManagerAccountDto(user.id, user.username, user.fullName, user.organisationId, user.createdAt);
    }

    @Transactional
    public StoreManagerAccountDto createOrUpdateStoreManager(Long organisationId, CreateStoreManagerRequest req) {
        if (req.username == null || req.username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Store Manager username is required");
        }
        if (req.fullName == null || req.fullName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Store Manager full name is required");
        }

        String username = req.username.trim();
        AppUser existingInOrg = userRepo.findFirstByOrganisationIdAndRoleIgnoreCase(organisationId, "Store Manager")
            .orElse(null);

        if (existingInOrg != null) {
            // Update existing store manager
            if (!existingInOrg.username.equalsIgnoreCase(username)) {
                // If changing username, check if another user has it
                if (userRepo.findByUsernameIgnoreCase(username).isPresent()) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Username '" + username + "' is already taken");
                }
                existingInOrg.username = username;
            }
            existingInOrg.fullName = req.fullName.trim();
            if (req.password != null && !req.password.isBlank()) {
                existingInOrg.passwordHash = PasswordUtils.hashPassword(req.password);
            }
            AppUser saved = userRepo.save(existingInOrg);
            return new StoreManagerAccountDto(saved.id, saved.username, saved.fullName, saved.organisationId, saved.createdAt);
        } else {
            // Create new store manager for this organisation
            if (req.password == null || req.password.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required for new Store Manager");
            }
            if (userRepo.findByUsernameIgnoreCase(username).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Username '" + username + "' is already registered");
            }
            String passwordHash = PasswordUtils.hashPassword(req.password);
            AppUser user = new AppUser(
                username,
                passwordHash,
                "Store Manager",
                organisationId,
                null,
                null,
                req.fullName.trim()
            );
            AppUser saved = userRepo.save(user);
            return new StoreManagerAccountDto(saved.id, saved.username, saved.fullName, saved.organisationId, saved.createdAt);
        }
    }

    private OrganisationSummaryDto toSummaryDto(Organisation org) {
        int branches = branchRepo.countByOrganisationId(org.id);
        int users = userRepo.countByOrganisationId(org.id);
        int items = itemRepo.countByOrganisationId(org.id);
        int orders = poRepo.countByOrganisationId(org.id);

        return new OrganisationSummaryDto(
            org.id,
            org.name,
            org.code,
            org.status,
            org.adminName,
            org.adminEmail,
            org.contactPhone,
            org.address,
            org.createdAt,
            branches,
            users,
            items,
            orders
        );
    }
}
