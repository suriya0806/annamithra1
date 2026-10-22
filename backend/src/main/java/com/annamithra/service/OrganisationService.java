package com.annamithra.service;

import com.annamithra.dto.*;
import com.annamithra.model.AppUser;
import com.annamithra.model.Branch;
import com.annamithra.model.Organisation;
import com.annamithra.repository.*;
import com.annamithra.security.PasswordUtils;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class OrganisationService {
    private final OrganisationRepository orgRepo;
    private final UserRepository userRepo;
    private final BranchRepository branchRepo;
    private final ItemRepository itemRepo;
    private final PurchaseOrderRepository poRepo;
    private final JdbcTemplate jdbcTemplate;

    public OrganisationService(OrganisationRepository orgRepo, UserRepository userRepo,
                               BranchRepository branchRepo, ItemRepository itemRepo,
                               PurchaseOrderRepository poRepo, JdbcTemplate jdbcTemplate) {
        this.orgRepo = orgRepo;
        this.userRepo = userRepo;
        this.branchRepo = branchRepo;
        this.itemRepo = itemRepo;
        this.poRepo = poRepo;
        this.jdbcTemplate = jdbcTemplate;
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

    public List<OrganisationAccountDto> getOrganisationAccounts(Long organisationId) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }

        List<Branch> branches = branchRepo.findByOrganisationIdOrderByIdAsc(organisationId);
        List<AppUser> orgUsers = userRepo.findByOrganisationId(organisationId);

        // Find primary Store Manager for organisation
        String primaryStoreManager = orgUsers.stream()
            .filter(u -> "Store Manager".equalsIgnoreCase(u.role))
            .map(u -> u.username)
            .findFirst()
            .orElse(null);

        List<OrganisationAccountDto> result = new ArrayList<>();
        Set<Long> processedUserIds = new HashSet<>();

        // 1. Store Manager accounts
        List<AppUser> storeManagers = orgUsers.stream()
            .filter(u -> "Store Manager".equalsIgnoreCase(u.role))
            .toList();

        for (AppUser sm : storeManagers) {
            processedUserIds.add(sm.id);
            result.add(new OrganisationAccountDto(
                sm.id,
                sm.username,
                sm.fullName != null ? sm.fullName : "Central Store Manager",
                "Store Manager",
                sm.branchId,
                sm.branchName != null ? sm.branchName : "Central Store (All Branches)",
                "Central Warehouse",
                "—",
                sm.createdAt,
                sm.updatedAt,
                sm.updatedBy,
                sm.username,
                "All Branches"
            ));
        }

        // 2. Branch Manager accounts for each branch
        for (Branch b : branches) {
            // Find AppUser linked to this branch
            AppUser bmUser = orgUsers.stream()
                .filter(u -> "Branch Manager".equalsIgnoreCase(u.role) &&
                    ((u.branchId != null && u.branchId.equals(b.id)) ||
                     (u.username != null && b.manager != null && u.username.equalsIgnoreCase(b.manager))))
                .findFirst()
                .orElse(null);

            if (bmUser != null) {
                processedUserIds.add(bmUser.id);
                result.add(new OrganisationAccountDto(
                    bmUser.id,
                    bmUser.username,
                    bmUser.fullName != null ? bmUser.fullName : (b.name + " Manager"),
                    "Branch Manager",
                    b.id,
                    b.name,
                    b.location,
                    b.contact,
                    bmUser.createdAt,
                    bmUser.updatedAt,
                    bmUser.updatedBy,
                    primaryStoreManager != null ? primaryStoreManager : "Unassigned",
                    bmUser.username
                ));
            } else {
                // Branch exists but manager AppUser hasn't been created yet
                result.add(new OrganisationAccountDto(
                    null,
                    b.manager != null ? b.manager : "Unassigned",
                    b.name + " Manager",
                    "Branch Manager",
                    b.id,
                    b.name,
                    b.location,
                    b.contact,
                    b.createdAt,
                    null,
                    null,
                    primaryStoreManager != null ? primaryStoreManager : "Unassigned",
                    b.manager != null ? b.manager : "Unassigned"
                ));
            }
        }

        // 3. Any remaining Branch Manager accounts in the organisation not linked to a specific branch
        for (AppUser u : orgUsers) {
            if ("Branch Manager".equalsIgnoreCase(u.role) && !processedUserIds.contains(u.id)) {
                result.add(new OrganisationAccountDto(
                    u.id,
                    u.username,
                    u.fullName != null ? u.fullName : "Branch Manager",
                    "Branch Manager",
                    u.branchId,
                    u.branchName != null ? u.branchName : "Unassigned Branch",
                    "—",
                    "—",
                    u.createdAt,
                    u.updatedAt,
                    u.updatedBy,
                    primaryStoreManager != null ? primaryStoreManager : "Unassigned",
                    u.username
                ));
            }
        }

        return result;
    }

    @Transactional
    public OrganisationAccountDto updateAccount(Long organisationId, Long userId, UpdateAccountRequest req, String adminUsername) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User ID is required");
        }

        AppUser user = userRepo.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User account not found"));

        // Strict Organisation Isolation: Cannot modify account from another organisation
        if (user.organisationId == null || !user.organisationId.equals(organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Cannot modify account from another organisation");
        }

        // Strict Role Isolation: Organisation Admin cannot edit Master Admin or other Organisation Admins
        if (!"Branch Manager".equalsIgnoreCase(user.role) && !"Store Manager".equalsIgnoreCase(user.role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You can only manage Branch Manager and Store Manager accounts");
        }

        boolean updated = false;

        // 1. Username update
        if (req.username != null && !req.username.isBlank()) {
            String newUsername = req.username.trim();
            if (!newUsername.equalsIgnoreCase(user.username)) {
                Optional<AppUser> existing = userRepo.findByUsernameIgnoreCase(newUsername);
                if (existing.isPresent() && !existing.get().id.equals(user.id)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Username '" + newUsername + "' is already taken");
                }
                String oldUsername = user.username;
                user.username = newUsername;

                // If user is Branch Manager, keep branch.manager in sync
                if ("Branch Manager".equalsIgnoreCase(user.role)) {
                    if (user.branchId != null) {
                        branchRepo.findById(user.branchId).ifPresent(b -> {
                            b.manager = newUsername;
                            branchRepo.save(b);
                        });
                    }
                    // Also check branches by oldUsername
                    List<Branch> orgBranches = branchRepo.findByOrganisationIdOrderByIdAsc(organisationId);
                    for (Branch b : orgBranches) {
                        if (b.manager != null && b.manager.equalsIgnoreCase(oldUsername)) {
                            b.manager = newUsername;
                            branchRepo.save(b);
                        }
                    }
                }

                // Update active user sessions
                try {
                    jdbcTemplate.update("UPDATE user_sessions SET username = ? WHERE user_id = ?", newUsername, user.id);
                } catch (Exception ignored) {}

                updated = true;
            }
        }

        // 2. Password update
        if (req.password != null && !req.password.isBlank()) {
            String newPassword = req.password.trim();
            if (newPassword.length() < 4) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 4 characters long");
            }
            user.passwordHash = PasswordUtils.hashPassword(newPassword);
            updated = true;
        }

        // 3. Full name update
        if (req.fullName != null && !req.fullName.isBlank()) {
            user.fullName = req.fullName.trim();
            updated = true;
        }

        if (updated) {
            user.updatedAt = LocalDateTime.now();
            user.updatedBy = adminUsername != null ? adminUsername : "Organisation Admin";
            user = userRepo.save(user);
        }

        Branch branch = user.branchId != null ? branchRepo.findById(user.branchId).orElse(null) : null;
        String storeManager = userRepo.findFirstByOrganisationIdAndRoleIgnoreCase(organisationId, "Store Manager")
            .map(u -> u.username)
            .orElse("Unassigned");

        return new OrganisationAccountDto(
            user.id,
            user.username,
            user.fullName,
            user.role,
            user.branchId,
            branch != null ? branch.name : (user.branchName != null ? user.branchName : ("Store Manager".equalsIgnoreCase(user.role) ? "Central Store (All Branches)" : "Unassigned Branch")),
            branch != null ? branch.location : ("Store Manager".equalsIgnoreCase(user.role) ? "Central Warehouse" : "—"),
            branch != null ? branch.contact : "—",
            user.createdAt,
            user.updatedAt,
            user.updatedBy,
            storeManager,
            user.username
        );
    }

    @Transactional
    public OrganisationAccountDto assignOrCreateBranchManager(Long organisationId, Long branchId, UpdateAccountRequest req, String adminUsername) {
        if (organisationId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Organisation ID is required");
        }
        if (branchId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch ID is required");
        }
        if (req.username == null || req.username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch Manager username is required");
        }
        if (req.password == null || req.password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required for new Branch Manager account");
        }

        Branch branch = branchRepo.findById(branchId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch not found"));

        if (branch.organisationId == null || !branch.organisationId.equals(organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Cannot access branch from another organisation");
        }

        String username = req.username.trim();
        String password = req.password.trim();
        if (password.length() < 4) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 4 characters long");
        }

        // Check if an existing user has this username
        Optional<AppUser> existing = userRepo.findByUsernameIgnoreCase(username);
        AppUser user;
        if (existing.isPresent()) {
            user = existing.get();
            if (!organisationId.equals(user.organisationId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Username '" + username + "' is already registered in another organisation");
            }
            user.branchId = branch.id;
            user.branchName = branch.name;
            user.passwordHash = PasswordUtils.hashPassword(password);
            if (req.fullName != null && !req.fullName.isBlank()) {
                user.fullName = req.fullName.trim();
            }
            user.updatedAt = LocalDateTime.now();
            user.updatedBy = adminUsername;
            user = userRepo.save(user);
        } else {
            String hash = PasswordUtils.hashPassword(password);
            user = new AppUser(
                username,
                hash,
                "Branch Manager",
                organisationId,
                branch.id,
                branch.name,
                req.fullName != null && !req.fullName.isBlank() ? req.fullName.trim() : (branch.name + " Manager")
            );
            user.updatedAt = LocalDateTime.now();
            user.updatedBy = adminUsername;
            user = userRepo.save(user);
        }

        branch.manager = user.username;
        branchRepo.save(branch);

        String storeManager = userRepo.findFirstByOrganisationIdAndRoleIgnoreCase(organisationId, "Store Manager")
            .map(u -> u.username)
            .orElse("Unassigned");

        return new OrganisationAccountDto(
            user.id,
            user.username,
            user.fullName,
            user.role,
            branch.id,
            branch.name,
            branch.location,
            branch.contact,
            user.createdAt,
            user.updatedAt,
            user.updatedBy,
            storeManager,
            user.username
        );
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
