package com.annamithra;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@SpringBootApplication
public class AnnamithraApplication {
    public static void main(String[] args) {
        SpringApplication.run(AnnamithraApplication.class, args);
    }
}

@RestController
@CrossOrigin
class HealthController {

    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of("status", "UP", "app", "Annamithra REST API", "health", "/api/health");
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "app", "Annamithra");
    }
}
