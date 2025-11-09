/**
 * Finacle Pre-Transaction Hook Example
 * 
 * This example shows how to integrate fraud detection into Finacle's
 * pre-transaction hook system.
 */

package com.bank.finacle.hooks;

import com.infosys.finacle.core.TransactionRequest;
import com.infosys.finacle.core.TransactionResponse;
import com.infosys.finacle.core.hooks.PreTransactionHook;
import com.bank.integration.FraudDetectionClient;
import com.bank.integration.FraudCheckResult;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class FraudDetectionPreTransactionHook implements PreTransactionHook {
    
    @Autowired
    private FraudDetectionClient fraudDetectionClient;
    
    @Override
    public TransactionResponse execute(TransactionRequest request) {
        
        try {
            // Transform Finacle transaction to fraud detection format
            FraudTransaction fraudTxn = transformTransaction(request);
            
            // Call fraud detection API
            FraudCheckResult result = fraudDetectionClient
                .checkTransaction(fraudTxn);
            
            // Process result
            if (result.getRiskScore() >= 80) {
                // High risk - reject transaction
                throw new TransactionRejectedException(
                    "Transaction rejected due to high fraud risk. " +
                    "Risk Score: " + result.getRiskScore() + ". " +
                    "Please contact customer support."
                );
            }
            
            if (result.getRiskScore() >= 50) {
                // Medium risk - flag for review but allow
                request.setReviewFlag(true);
                request.setReviewReason(
                    "Medium risk transaction. Risk Score: " + 
                    result.getRiskScore()
                );
                
                // Log for review team
                logForReview(request, result);
            }
            
            // Low risk or medium risk (flagged) - proceed
            return TransactionResponse.approved();
            
        } catch (FraudDetectionException e) {
            // Handle fraud detection API errors
            // Fail open or closed based on configuration
            if (isFailOpen()) {
                // Allow transaction if API is down
                logWarning("Fraud detection API error, allowing transaction: " + 
                          e.getMessage());
                return TransactionResponse.approved();
            } else {
                // Block transaction if API is down (fail closed)
                throw new TransactionRejectedException(
                    "Unable to verify transaction. Please try again later."
                );
            }
        }
    }
    
    private FraudTransaction transformTransaction(TransactionRequest request) {
        FraudTransaction fraudTxn = new FraudTransaction();
        
        fraudTxn.setSenderAccountNumber(request.getDebitAccount());
        fraudTxn.setReceiverAccountNumber(request.getCreditAccount());
        fraudTxn.setAmount(request.getAmount());
        fraudTxn.setTransactionType(mapTransactionType(request.getTransactionCode()));
        fraudTxn.setLocation(extractLocation(request));
        fraudTxn.setDevice(extractDevice(request));
        fraudTxn.setIpAddress(request.getClientIpAddress());
        fraudTxn.setTimestamp(request.getTransactionDate());
        
        return fraudTxn;
    }
    
    private String mapTransactionType(String finacleCode) {
        switch (finacleCode) {
            case "FT": return "Transfer";
            case "CW": return "Withdrawal";
            case "CD": return "Deposit";
            case "BP": return "Payment";
            case "CH": return "Payment"; // Cheque
            default: return "Transfer";
        }
    }
    
    private String extractLocation(TransactionRequest request) {
        // Extract location from Finacle transaction
        // Could be from branch code, GPS data, or IP geolocation
        if (request.getBranchCode() != null) {
            return "NG-" + request.getBranchCode();
        }
        if (request.getGeoLocation() != null) {
            return request.getGeoLocation();
        }
        return null;
    }
    
    private String extractDevice(TransactionRequest request) {
        // Extract device information
        String channel = request.getChannelType();
        if (channel != null) {
            switch (channel) {
                case "MOBILE": return request.getDeviceInfo() != null 
                    ? request.getDeviceInfo() : "Mobile";
                case "INTERNET": return "Web";
                case "ATM": return "ATM";
                case "BRANCH": return "Branch";
                default: return "Unknown";
            }
        }
        return "Unknown";
    }
    
    private void logForReview(TransactionRequest request, FraudCheckResult result) {
        // Log transaction for review team
        ReviewLog log = new ReviewLog();
        log.setTransactionId(request.getTransactionId());
        log.setRiskScore(result.getRiskScore());
        log.setReason(result.getReason());
        log.setTimestamp(new Date());
        
        // Send to review queue or database
        reviewService.queueForReview(log);
    }
    
    private boolean isFailOpen() {
        // Check configuration - fail open means allow on error
        // fail closed means block on error
        return configurationService.getFraudDetectionFailOpen();
    }
}

/**
 * Fraud Detection Client Interface
 */
package com.bank.integration;

public interface FraudDetectionClient {
    FraudCheckResult checkTransaction(FraudTransaction transaction) 
        throws FraudDetectionException;
}

/**
 * Fraud Detection Client Implementation
 */
package com.bank.integration.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class FraudDetectionClientImpl implements FraudDetectionClient {
    
    @Value("${fraud.detection.api.url}")
    private String apiUrl;
    
    @Value("${fraud.detection.api.username}")
    private String username;
    
    @Value("${fraud.detection.api.password}")
    private String password;
    
    private RestTemplate restTemplate;
    private String accessToken;
    private Date tokenExpiry;
    
    @Override
    public FraudCheckResult checkTransaction(FraudTransaction transaction) {
        
        // Ensure authenticated
        ensureAuthenticated();
        
        // Prepare request
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);
        
        HttpEntity<FraudTransaction> request = 
            new HttpEntity<>(transaction, headers);
        
        try {
            // Call fraud detection API
            ResponseEntity<FraudCheckResult> response = restTemplate.exchange(
                apiUrl + "/api/transactions",
                HttpMethod.POST,
                request,
                FraudCheckResult.class
            );
            
            return response.getBody();
            
        } catch (RestClientException e) {
            throw new FraudDetectionException(
                "Error calling fraud detection API: " + e.getMessage(), e
            );
        }
    }
    
    private void ensureAuthenticated() {
        if (accessToken != null && new Date().before(tokenExpiry)) {
            return; // Token still valid
        }
        
        // Login to get new token
        LoginRequest loginRequest = new LoginRequest(username, password);
        HttpEntity<LoginRequest> request = new HttpEntity<>(loginRequest);
        
        ResponseEntity<LoginResponse> response = restTemplate.exchange(
            apiUrl + "/api/auths/login",
            HttpMethod.POST,
            request,
            LoginResponse.class
        );
        
        LoginResponse loginResponse = response.getBody();
        accessToken = loginResponse.getToken();
        
        // Set expiry (assuming 1 hour, adjust based on actual token expiry)
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.HOUR, 1);
        tokenExpiry = cal.getTime();
    }
}

