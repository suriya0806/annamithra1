package com.annamithra.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private Map<String, Object> createErrorBody(String message, int status) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toEpochMilli());
        body.put("status", status);
        body.put("error", message);
        body.put("message", message);
        return body;
    }

    private boolean isTechnicalOrSql(String text) {
        if (text == null) return false;
        String s = text.toLowerCase();
        return s.contains("could not execute statement") ||
               s.contains("syntax error") ||
               s.contains("violates unique constraint") ||
               s.contains("duplicate key value") ||
               s.contains("foreign key constraint") ||
               s.contains("psqlexception") ||
               s.contains("org.hibernate") ||
               s.contains("sql [") ||
               s.contains("insert into") ||
               s.contains("select ") ||
               s.contains("update ") ||
               s.contains("delete from") ||
               s.contains("constraint [");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        // Detailed error preserved in developer logs for debugging
        log.error("Database constraint or integrity violation: {}", ex.getMessage(), ex);

        Throwable rootCause = ex.getRootCause();
        String rootMsg = (rootCause != null && rootCause.getMessage() != null) ? rootCause.getMessage() : "";
        String exMsg = ex.getMessage() != null ? ex.getMessage() : "";
        String raw = (exMsg + " " + rootMsg).trim();
        String rawLower = raw.toLowerCase();

        String friendlyMessage = "Operation failed due to a data conflict.";
        if (rawLower.contains("duplicate") || rawLower.contains("unique") || rawLower.contains("already exists")) {
            if (rawLower.contains("item_category") || rawLower.contains("category")) {
                friendlyMessage = "Category already exists.";
            } else if (rawLower.contains("uk_item_org_name") || rawLower.contains("item") || rawLower.contains("catalogue")) {
                friendlyMessage = "Item already exists.";
            } else if (rawLower.contains("username") || rawLower.contains("app_users")) {
                friendlyMessage = "Username already exists.";
            } else if (rawLower.contains("branch")) {
                friendlyMessage = "Branch already exists.";
            } else if (rawLower.contains("organisation") || rawLower.contains("organisations_code_key")) {
                friendlyMessage = "Organisation already exists.";
            } else if (rawLower.contains("order_number") || rawLower.contains("purchase_order")) {
                friendlyMessage = "Order number already exists.";
            } else {
                friendlyMessage = "Item already exists.";
            }
        } else if (rawLower.contains("foreign key") || rawLower.contains("violates foreign key")) {
            friendlyMessage = "Please check the entered details.";
        }

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(createErrorBody(friendlyMessage, HttpStatus.CONFLICT.value()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatusException(ResponseStatusException ex) {
        log.warn("ResponseStatusException [{}]: {}", ex.getStatusCode(), ex.getReason(), ex);

        String reason = ex.getReason();
        String message = reason;

        if (reason == null || reason.isBlank()) {
            if (ex.getStatusCode().value() == 400) message = "Please check the entered details.";
            else if (ex.getStatusCode().value() == 401) message = "Invalid username or password.";
            else if (ex.getStatusCode().value() == 403) message = "Access denied.";
            else if (ex.getStatusCode().value() == 404) message = "Resource not found.";
            else if (ex.getStatusCode().value() == 409) message = "Item already exists.";
            else message = "Operation failed. Please try again.";
        } else if (isTechnicalOrSql(reason)) {
            String lower = reason.toLowerCase();
            if (lower.contains("category") && (lower.contains("duplicate") || lower.contains("unique") || lower.contains("exists"))) {
                message = "Category already exists.";
            } else if (lower.contains("item") && (lower.contains("duplicate") || lower.contains("unique") || lower.contains("exists"))) {
                message = "Item already exists.";
            } else if (ex.getStatusCode().value() == 400) {
                message = "Please check the entered details.";
            } else if (ex.getStatusCode().value() == 401) {
                message = "Invalid username or password.";
            } else {
                message = "Operation failed. Please try again.";
            }
        } else {
            // Standardize key business messages according to requirements
            String lower = reason.toLowerCase().trim();
            if (lower.contains("already exists in the catalogue") || (lower.contains("item") && lower.contains("already exists"))) {
                message = "Item already exists.";
            } else if (lower.contains("category already exists") || (lower.contains("category") && lower.contains("already exists"))) {
                message = "Category already exists.";
            } else if (lower.contains("invalid username or password") || lower.contains("bad credentials")) {
                message = "Invalid username or password.";
            }
        }

        return ResponseEntity.status(ex.getStatusCode())
                .body(createErrorBody(message, ex.getStatusCode().value()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        log.warn("Validation failure: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(createErrorBody("Please check the entered details.", HttpStatus.BAD_REQUEST.value()));
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<Map<String, Object>> handleBindException(BindException ex) {
        log.warn("Bind failure: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(createErrorBody("Please check the entered details.", HttpStatus.BAD_REQUEST.value()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleNotReadable(HttpMessageNotReadableException ex) {
        log.warn("Malformed JSON payload: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(createErrorBody("Please check the entered details.", HttpStatus.BAD_REQUEST.value()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("Argument type mismatch: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(createErrorBody("Please check the entered details.", HttpStatus.BAD_REQUEST.value()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        // Complete stack trace preserved in developer console / logs for debugging
        log.error("Unhandled server exception: {}", ex.getMessage(), ex);

        // Sanitize technical messages so end users only see clear, professional feedback
        String msg = ex.getMessage();
        if (msg != null && isTechnicalOrSql(msg)) {
            msg = "Operation failed. Please try again.";
        }
        if (msg == null || msg.isBlank()) {
            msg = "Operation failed. Please try again.";
        }

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(createErrorBody(msg, HttpStatus.INTERNAL_SERVER_ERROR.value()));
    }
}
