package com.annamithra.service;

import com.annamithra.model.AppUser;
import com.annamithra.model.Branch;
import com.annamithra.model.Item;
import com.annamithra.repository.BranchRepository;
import com.annamithra.repository.ItemRepository;
import com.annamithra.repository.UserRepository;
import com.annamithra.security.PasswordUtils;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import org.springframework.jdbc.core.JdbcTemplate;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepo;
    private final BranchRepository branchRepo;
    private final ItemRepository itemRepo;
    private final JdbcTemplate jdbcTemplate;

    public DataInitializer(UserRepository userRepo, BranchRepository branchRepo,
                           ItemRepository itemRepo,
                           JdbcTemplate jdbcTemplate) {
        this.userRepo = userRepo;
        this.branchRepo = branchRepo;
        this.itemRepo = itemRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    private void runMigrations() {
        // 1. Create organisations table
        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS organisations (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "name VARCHAR(255) NOT NULL, " +
                "code VARCHAR(64) UNIQUE NOT NULL, " +
                "status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', " +
                "admin_name VARCHAR(255), " +
                "admin_email VARCHAR(255), " +
                "contact_phone VARCHAR(64), " +
                "address VARCHAR(500), " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")");
        } catch (Exception e) {
            System.err.println("Migration error organisations: " + e.getMessage());
        }

        // 2. Add organisation_id columns
        String[] tables = {
            "app_users", "user_sessions", "branch", "item", "purchase_order",
            "purchase_order_header", "purchase_receipt", "branch_request",
            "dispatch", "dispatch_return", "inventory_transaction", "item_category"
        };
        for (String table : tables) {
            try {
                jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN IF NOT EXISTS organisation_id BIGINT");
            } catch (Exception ignored) {}
        }

        // Add category and audit columns for inventory items & transactions
        try {
            jdbcTemplate.execute("ALTER TABLE item ADD COLUMN IF NOT EXISTS category VARCHAR(100)");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE inventory_transaction ADD COLUMN IF NOT EXISTS category VARCHAR(100)");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE inventory_transaction ADD COLUMN IF NOT EXISTS created_by_admin_id BIGINT");
        } catch (Exception ignored) {}
        // Create item_category table if not exists
        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS item_category (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "organisation_id BIGINT, " +
                "name VARCHAR(100) NOT NULL, " +
                "active BOOLEAN DEFAULT TRUE, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "created_by VARCHAR(128), " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")");
        } catch (Exception ignored) {}

        // Add category_id, created_by, updated_at to item table if not exists
        try {
            jdbcTemplate.execute("ALTER TABLE item ADD COLUMN IF NOT EXISTS category_id BIGINT");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE item ADD COLUMN IF NOT EXISTS created_by VARCHAR(128)");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE item ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        } catch (Exception ignored) {}

        // 3. Drop single-column unique constraints that block multi-tenancy
        try {
            jdbcTemplate.execute("ALTER TABLE item DROP CONSTRAINT IF EXISTS item_name_key");
        } catch (Exception ignored) {}
        try {
            jdbcTemplate.execute("ALTER TABLE branch DROP CONSTRAINT IF EXISTS branch_name_key");
        } catch (Exception ignored) {}

        // 4. Ensure default organisation (Saravana Bhavan Group) exists with ID 1
        try {
            jdbcTemplate.execute("INSERT INTO organisations (id, name, code, status, admin_name, admin_email, contact_phone, address, created_at, updated_at) " +
                "VALUES (1, 'Saravana Bhavan Group', 'SARAVANAS', 'ACTIVE', 'Organisation Administrator', 'admin@saravanas', '9876543210', 'Chennai, Tamil Nadu', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) " +
                "ON CONFLICT (id) DO NOTHING");
            jdbcTemplate.execute("SELECT setval('organisations_id_seq', (SELECT GREATEST(MAX(id), 1) FROM organisations))");
        } catch (Exception ignored) {}

        // 5. Backfill existing records to organisation_id = 1
        for (String table : tables) {
            try {
                if ("app_users".equals(table)) {
                    jdbcTemplate.execute("UPDATE app_users SET organisation_id = 1 WHERE organisation_id IS NULL AND LOWER(role) != 'master admin'");
                } else {
                    jdbcTemplate.execute("UPDATE " + table + " SET organisation_id = 1 WHERE organisation_id IS NULL");
                }
            } catch (Exception ignored) {}
        }

        // 6. Ensure legacy columns
        try {
            jdbcTemplate.execute("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            jdbcTemplate.execute("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS updated_by VARCHAR(128)");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE branch_request ADD COLUMN IF NOT EXISTS dispatched integer DEFAULT 0");
            jdbcTemplate.execute("UPDATE branch_request SET dispatched = 0 WHERE dispatched IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE branch_request ADD COLUMN IF NOT EXISTS category VARCHAR(100)");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS unit varchar(255) DEFAULT 'KG'");
            jdbcTemplate.execute("UPDATE dispatch SET unit = 'KG' WHERE unit IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS is_additional boolean DEFAULT false");
            jdbcTemplate.execute("UPDATE dispatch SET is_additional = false WHERE is_additional IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS acknowledged_quantity integer DEFAULT 0");
            jdbcTemplate.execute("UPDATE dispatch SET acknowledged_quantity = 0 WHERE acknowledged_quantity IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS shortage_quantity integer DEFAULT 0");
            jdbcTemplate.execute("UPDATE dispatch SET shortage_quantity = 0 WHERE shortage_quantity IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS acknowledgement_status varchar(64)");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS acknowledgement_remarks varchar(500)");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS returned_quantity integer DEFAULT 0");
            jdbcTemplate.execute("UPDATE dispatch SET returned_quantity = 0 WHERE returned_quantity IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS returned_at timestamp");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS return_reason varchar(500)");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE dispatch ADD COLUMN IF NOT EXISTS dispatched_by varchar(128)");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS dispatch_return (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "dispatch_id BIGINT NOT NULL, " +
                "dispatch_number VARCHAR(64), " +
                "branch_name VARCHAR(255) NOT NULL, " +
                "item_name VARCHAR(255) NOT NULL, " +
                "unit VARCHAR(32) DEFAULT 'KG', " +
                "return_quantity INTEGER NOT NULL, " +
                "reason VARCHAR(500), " +
                "return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "returned_by VARCHAR(128), " +
                "organisation_id BIGINT" +
                ")");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS required_quantity integer DEFAULT 0");
            jdbcTemplate.execute("UPDATE purchase_order SET required_quantity = 0 WHERE required_quantity IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS purchase_order_header (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "order_number VARCHAR(64) UNIQUE NOT NULL, " +
                "source VARCHAR(64) DEFAULT 'STORE_MANAGER', " +
                "status VARCHAR(64) DEFAULT 'PENDING', " +
                "order_date DATE DEFAULT CURRENT_DATE, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "created_by VARCHAR(128), " +
                "ordered_at TIMESTAMP, " +
                "ordered_by VARCHAR(128), " +
                "organisation_id BIGINT" +
                ")");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS header_id BIGINT");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("ALTER TABLE purchase_order ADD COLUMN IF NOT EXISTS request_date DATE");
            jdbcTemplate.execute("UPDATE purchase_order SET request_date = order_date WHERE request_date IS NULL");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS store_order_draft (" +
                "username VARCHAR(128) PRIMARY KEY, " +
                "draft_json TEXT NOT NULL, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                ")");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS branch_order_draft (" +
                "id BIGSERIAL PRIMARY KEY, " +
                "organisation_id BIGINT, " +
                "branch_id BIGINT, " +
                "branch_name VARCHAR(128) NOT NULL, " +
                "draft_name VARCHAR(255), " +
                "status VARCHAR(64) DEFAULT 'DRAFT', " +
                "item_count INTEGER DEFAULT 0, " +
                "total_quantity INTEGER DEFAULT 0, " +
                "items_json TEXT NOT NULL, " +
                "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
                "created_by VARCHAR(128)" +
                ")");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("UPDATE purchase_order SET po_number = CONCAT('PO-', id) WHERE po_number IS NULL OR TRIM(po_number) = ''");
        } catch (Exception ignored) {}

        try {
            jdbcTemplate.execute("UPDATE dispatch SET dispatch_number = CONCAT('DSP-', id) WHERE dispatch_number IS NULL OR TRIM(dispatch_number) = ''");
        } catch (Exception ignored) {}
        // Seed default item categories
        String[] defaultCategories = {
            "Dairy", "Pulses", "Vegetables", "Groceries", "Tea/Coffee",
            "Vada Stall", "Sweet/Savouries", "Dosa Kal", "Chinese",
            "Idly", "Front Office", "Parcel", "Dishwasher"
        };
        for (String catName : defaultCategories) {
            try {
                jdbcTemplate.update("INSERT INTO item_category (organisation_id, name, active, created_by, created_at, updated_at) " +
                    "SELECT 1, ?, true, 'System', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP " +
                    "WHERE NOT EXISTS (SELECT 1 FROM item_category WHERE organisation_id = 1 AND LOWER(TRIM(name)) = LOWER(?))",
                    catName, catName);
            } catch (Exception ignored) {}
        }

        // Backfill item.category_id based on matching category name
        try {
            jdbcTemplate.execute("UPDATE item i " +
                "SET category_id = c.id " +
                "FROM item_category c " +
                "WHERE i.category_id IS NULL " +
                "  AND (i.organisation_id = c.organisation_id OR (i.organisation_id IS NULL AND c.organisation_id = 1)) " +
                "  AND LOWER(TRIM(i.category)) = LOWER(TRIM(c.name))");
        } catch (Exception ignored) {}

        // Migrate quantity columns to NUMERIC(12, 3) to support fractional/decimal quantities
        String[] decimalMigrations = {
            "ALTER TABLE item ALTER COLUMN stock TYPE NUMERIC(12,3) USING stock::NUMERIC(12,3)",
            "ALTER TABLE branch_request ALTER COLUMN requested TYPE NUMERIC(12,3) USING requested::NUMERIC(12,3)",
            "ALTER TABLE branch_request ALTER COLUMN dispatched TYPE NUMERIC(12,3) USING dispatched::NUMERIC(12,3)",
            "ALTER TABLE branch_request ALTER COLUMN received TYPE NUMERIC(12,3) USING received::NUMERIC(12,3)",
            "ALTER TABLE dispatch ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::NUMERIC(12,3)",
            "ALTER TABLE dispatch ALTER COLUMN acknowledged_quantity TYPE NUMERIC(12,3) USING acknowledged_quantity::NUMERIC(12,3)",
            "ALTER TABLE dispatch ALTER COLUMN shortage_quantity TYPE NUMERIC(12,3) USING shortage_quantity::NUMERIC(12,3)",
            "ALTER TABLE dispatch ALTER COLUMN returned_quantity TYPE NUMERIC(12,3) USING returned_quantity::NUMERIC(12,3)",
            "ALTER TABLE dispatch_return ALTER COLUMN return_quantity TYPE NUMERIC(12,3) USING return_quantity::NUMERIC(12,3)",
            "ALTER TABLE purchase_order ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::NUMERIC(12,3)",
            "ALTER TABLE purchase_order ALTER COLUMN required_quantity TYPE NUMERIC(12,3) USING required_quantity::NUMERIC(12,3)",
            "ALTER TABLE purchase_order ALTER COLUMN received_qty TYPE NUMERIC(12,3) USING received_qty::NUMERIC(12,3)",
            "ALTER TABLE purchase_receipt ALTER COLUMN received_qty TYPE NUMERIC(12,3) USING received_qty::NUMERIC(12,3)",
            "ALTER TABLE inventory_transaction ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::NUMERIC(12,3)",
            "ALTER TABLE inventory_transaction ALTER COLUMN balance_after TYPE NUMERIC(12,3) USING balance_after::NUMERIC(12,3)",
            "ALTER TABLE branch_order_draft ALTER COLUMN total_quantity TYPE NUMERIC(12,3) USING total_quantity::NUMERIC(12,3)"
        };
        for (String sql : decimalMigrations) {
            try {
                jdbcTemplate.execute(sql);
            } catch (Exception ignored) {}
        }


    }

    @Override
    public void run(String... args) {
        runMigrations();

        // 1. Ensure Master Admin account
        if (userRepo.findByUsernameIgnoreCase("master@admin").isEmpty()) {
            String hash = PasswordUtils.hashPassword("1234");
            userRepo.save(new AppUser("master@admin", hash, "Master Admin", null, null, null, "Master Admin"));
        }

        // 2. Ensure initial branches for Org 1
        Branch branch1 = branchRepo.findByOrganisationIdAndNameIgnoreCase(1L, "Branch 1").orElseGet(() -> {
            Branch b = new Branch("Branch 1", "Madurai", "Branch1", "9876543210");
            b.organisationId = 1L;
            return branchRepo.save(b);
        });

        if (branchRepo.findByOrganisationIdAndNameIgnoreCase(1L, "Main Branch").isEmpty()) {
            Branch b2 = new Branch("Main Branch", "Chennai", "suriya", "9123456780");
            b2.organisationId = 1L;
            branchRepo.save(b2);
        }

        // 3. Ensure initial users for Org 1 with secure password hashes
        if (userRepo.findByUsernameIgnoreCase("admin@saravanas").isEmpty()) {
            String hash = PasswordUtils.hashPassword("1234");
            userRepo.save(new AppUser("admin@saravanas", hash, "Organisation Admin", 1L, null, null, "Organisation Administrator"));
        } else {
            userRepo.findByUsernameIgnoreCase("admin@saravanas").ifPresent(u -> {
                if (u.organisationId == null) {
                    u.organisationId = 1L;
                    userRepo.save(u);
                }
            });
        }

        if (userRepo.findByUsernameIgnoreCase("store@manager").isEmpty()) {
            String hash = PasswordUtils.hashPassword("1234");
            userRepo.save(new AppUser("store@manager", hash, "Store Manager", 1L, null, null, "Central Store Manager"));
        } else {
            userRepo.findByUsernameIgnoreCase("store@manager").ifPresent(u -> {
                if (u.organisationId == null) {
                    u.organisationId = 1L;
                    userRepo.save(u);
                }
            });
        }

        if (userRepo.findByUsernameIgnoreCase("Branch1").isEmpty()) {
            String hash = PasswordUtils.hashPassword("1234");
            userRepo.save(new AppUser("Branch1", hash, "Branch Manager", 1L, branch1.id, branch1.name, "Branch 1 Manager"));
        } else {
            userRepo.findByUsernameIgnoreCase("Branch1").ifPresent(u -> {
                if (u.organisationId == null) {
                    u.organisationId = 1L;
                    userRepo.save(u);
                }
            });
        }

        branchRepo.findByOrganisationIdAndNameIgnoreCase(1L, "Main Branch").ifPresent(b2 -> {
            if (userRepo.findByUsernameIgnoreCase("suriya").isEmpty()) {
                String hash = PasswordUtils.hashPassword("1234");
                userRepo.save(new AppUser("suriya", hash, "Branch Manager", 1L, b2.id, b2.name, "Main Branch Manager"));
            }
        });

        // 4. Ensure initial catalogue items for Org 1
        ensureItem("Rice", "KG", 40, 1L);
        ensureItem("Cooking Oil", "L", 15, 1L);
        ensureItem("Curd", "L", 10, 1L);
        ensureItem("Sugar", "KG", 25, 1L);
    }

    private void ensureItem(String name, String unit, int defaultStock, Long orgId) {
        itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, name).orElseGet(() -> {
            Item i = new Item(name, unit, defaultStock);
            i.organisationId = orgId;
            return itemRepo.save(i);
        });
    }
}
