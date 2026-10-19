package com.annamithra.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DatabaseConfig {

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${spring.datasource.username:postgres}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Value("${spring.datasource.driver-class-name:org.postgresql.Driver}")
    private String driverClassName;

    @Bean
    @Primary
    public DataSource dataSource(
            @Value("${spring.datasource.hikari.maximum-pool-size:5}") int maxPoolSize,
            @Value("${spring.datasource.hikari.connection-timeout:60000}") long connectionTimeout,
            @Value("${spring.datasource.hikari.max-lifetime:120000}") long maxLifetime,
            @Value("${spring.datasource.hikari.keepalive-time:30000}") long keepaliveTime
    ) {
        String finalUrl = datasourceUrl;
        String finalUser = username;
        String finalPassword = password;

        if (finalUrl != null && !finalUrl.isBlank()) {
            finalUrl = finalUrl.trim();
            // Automatically adapt Render / Supabase URI (postgres:// or postgresql://) to JDBC format
            if (finalUrl.startsWith("postgres://") || finalUrl.startsWith("postgresql://")) {
                try {
                    URI uri = new URI(finalUrl);
                    String host = uri.getHost();
                    int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                    String path = uri.getPath();

                    if (uri.getUserInfo() != null) {
                        String[] parts = uri.getUserInfo().split(":", 2);
                        if (parts.length > 0 && !parts[0].isBlank()) {
                            finalUser = parts[0];
                        }
                        if (parts.length > 1 && !parts[1].isBlank()) {
                            finalPassword = parts[1];
                        }
                    }

                    String query = uri.getQuery();
                    finalUrl = "jdbc:postgresql://" + host + ":" + port + path
                            + (query != null && !query.isBlank() ? "?" + query : "?sslmode=require");
                } catch (Exception e) {
                    if (!finalUrl.startsWith("jdbc:")) {
                        finalUrl = "jdbc:" + finalUrl;
                    }
                }
            }
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(finalUrl);
        config.setUsername(finalUser);
        config.setPassword(finalPassword);
        config.setDriverClassName(driverClassName);
        config.setMaximumPoolSize(maxPoolSize);
        config.setConnectionTimeout(connectionTimeout);
        config.setMaxLifetime(maxLifetime);
        config.setKeepaliveTime(keepaliveTime);
        config.setConnectionTestQuery("SELECT 1");

        return new HikariDataSource(config);
    }
}
