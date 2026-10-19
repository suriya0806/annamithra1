package com.annamithra.dto;

public class LoginResponse {
    public String token;
    public Long id;
    public String username;
    public String role;
    public Long organisationId;
    public String organisationName;
    public String organisationCode;
    public Long branchId;
    public String branchName;
    public String fullName;

    public LoginResponse(String token, Long id, String username, String role, Long branchId, String branchName, String fullName) {
        this.token = token;
        this.id = id;
        this.username = username;
        this.role = role;
        this.branchId = branchId;
        this.branchName = branchName;
        this.fullName = fullName;
    }

    public LoginResponse(String token, Long id, String username, String role, Long organisationId, String organisationName, String organisationCode, Long branchId, String branchName, String fullName) {
        this.token = token;
        this.id = id;
        this.username = username;
        this.role = role;
        this.organisationId = organisationId;
        this.organisationName = organisationName;
        this.organisationCode = organisationCode;
        this.branchId = branchId;
        this.branchName = branchName;
        this.fullName = fullName;
    }
}
