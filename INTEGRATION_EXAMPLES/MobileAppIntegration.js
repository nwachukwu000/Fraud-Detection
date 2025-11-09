/**
 * Mobile Banking App Integration Example
 * 
 * This example shows how a mobile banking app (React Native / Flutter)
 * integrates with the bank's API, which in turn integrates with
 * Finacle and Fraud Detection System.
 */

// ============================================
// React Native Example
// ============================================

import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, ActivityIndicator } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import Geolocation from '@react-native-community/geolocation';

const TransferScreen = () => {
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Submit transaction to bank API
   * The bank API will:
   * 1. Forward to Finacle
   * 2. Finacle triggers fraud detection
   * 3. Returns result to mobile app
   */
  const handleTransfer = async () => {
    if (!fromAccount || !toAccount || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      // Get device information
      const deviceInfo = {
        deviceId: await DeviceInfo.getUniqueId(),
        deviceName: DeviceInfo.getDeviceName(),
        deviceModel: DeviceInfo.getModel(),
        osVersion: DeviceInfo.getSystemVersion(),
        appVersion: DeviceInfo.getVersion(),
      };

      // Get location (if user has granted permission)
      let location = null;
      try {
        const position = await getCurrentPosition();
        location = `NG-${position.coords.latitude},${position.coords.longitude}`;
      } catch (error) {
        console.log('Location not available:', error);
      }

      // Get IP address (from network info or API)
      const ipAddress = await getIpAddress();

      // Prepare transaction request
      const transactionData = {
        fromAccount: fromAccount,
        toAccount: toAccount,
        amount: parseFloat(amount),
        type: 'transfer',
        // Device and location info will be added by bank API
        // but we can also send it explicitly
        metadata: {
          device: deviceInfo,
          location: location,
          ipAddress: ipAddress,
        },
      };

      // Call bank API
      const response = await fetch('https://bank-api.example.com/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
          'X-Device-ID': deviceInfo.deviceId,
          'X-App-Version': deviceInfo.appVersion,
        },
        body: JSON.stringify(transactionData),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // Transaction successful
        Alert.alert(
          'Success',
          `Transfer of ₦${amount} to ${toAccount} completed successfully!`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        // Handle different error scenarios
        handleTransactionError(result);
      }
    } catch (error) {
      console.error('Transaction error:', error);
      Alert.alert(
        'Error',
        'Network error. Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle transaction errors from bank API
   */
  const handleTransactionError = (error) => {
    const errorCode = error.code;
    const errorMessage = error.message;

    switch (errorCode) {
      case 'FRAUD_RISK_HIGH':
        // High fraud risk - transaction blocked
        Alert.alert(
          'Transaction Blocked',
          'This transaction cannot be processed due to security concerns. ' +
          'Please contact customer support at 0700-123-4567 for assistance.',
          [
            { text: 'Contact Support', onPress: () => callSupport() },
            { text: 'OK', style: 'cancel' },
          ]
        );
        break;

      case 'FRAUD_RISK_MEDIUM':
        // Medium risk - transaction may be flagged but allowed
        Alert.alert(
          'Transaction Processing',
          'Your transaction is being processed. ' +
          'It may be subject to additional verification.',
          [{ text: 'OK' }]
        );
        break;

      case 'INSUFFICIENT_FUNDS':
        Alert.alert('Error', 'Insufficient funds in your account.');
        break;

      case 'INVALID_ACCOUNT':
        Alert.alert('Error', 'Invalid recipient account number.');
        break;

      case 'TRANSACTION_LIMIT_EXCEEDED':
        Alert.alert(
          'Error',
          'Transaction amount exceeds your daily limit. ' +
          'Please contact your bank to increase your limit.'
        );
        break;

      default:
        Alert.alert(
          'Error',
          errorMessage || 'Transaction failed. Please try again.'
        );
    }
  };

  /**
   * Get current position (with permission)
   */
  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        resolve,
        reject,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    });
  };

  /**
   * Get device IP address
   */
  const getIpAddress = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return null;
    }
  };

  /**
   * Get authentication token
   */
  const getAuthToken = async () => {
    // Retrieve stored token from secure storage
    // This would typically use something like react-native-keychain
    return await SecureStorage.getItem('authToken');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transfer Money</Text>

      <TextInput
        style={styles.input}
        placeholder="From Account"
        value={fromAccount}
        onChangeText={setFromAccount}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="To Account"
        value={toAccount}
        onChangeText={setToAccount}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <Button
        title={loading ? 'Processing...' : 'Transfer'}
        onPress={handleTransfer}
        disabled={loading}
      />

      {loading && <ActivityIndicator size="large" />}
    </View>
  );
};

// ============================================
// Flutter Example (Dart)
// ============================================

/*
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:device_info_plus/device_info_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:convert';

class TransferScreen extends StatefulWidget {
  @override
  _TransferScreenState createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fromAccountController = TextEditingController();
  final _toAccountController = TextEditingController();
  final _amountController = TextEditingController();
  bool _isLoading = false;

  Future<void> _handleTransfer() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // Get device information
      final deviceInfo = DeviceInfoPlugin();
      String deviceId = '';
      String deviceName = '';
      
      if (Platform.isAndroid) {
        AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
        deviceId = androidInfo.id;
        deviceName = androidInfo.model;
      } else if (Platform.isIOS) {
        IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
        deviceId = iosInfo.identifierForVendor ?? '';
        deviceName = iosInfo.model;
      }

      // Get location
      Position? position;
      String? location;
      try {
        position = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );
        location = 'NG-${position.latitude},${position.longitude}';
      } catch (e) {
        print('Location not available: $e');
      }

      // Prepare transaction
      final transactionData = {
        'fromAccount': _fromAccountController.text,
        'toAccount': _toAccountController.text,
        'amount': double.parse(_amountController.text),
        'type': 'transfer',
        'metadata': {
          'deviceId': deviceId,
          'deviceName': deviceName,
          'location': location,
        },
      };

      // Get auth token
      final authToken = await SecureStorage.read(key: 'authToken');

      // Call bank API
      final response = await http.post(
        Uri.parse('https://bank-api.example.com/api/transactions'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
          'X-Device-ID': deviceId,
        },
        body: jsonEncode(transactionData),
      ).timeout(Duration(seconds: 30));

      final result = jsonDecode(response.body);

      if (response.statusCode == 200 && result['status'] == 'success') {
        // Success
        _showSuccessDialog('Transfer completed successfully!');
      } else {
        // Handle error
        _handleError(result);
      }
    } catch (e) {
      _showErrorDialog('Network error. Please try again.');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _handleError(Map<String, dynamic> error) {
    final errorCode = error['code'];
    final errorMessage = error['message'];

    switch (errorCode) {
      case 'FRAUD_RISK_HIGH':
        _showErrorDialog(
          'This transaction cannot be processed due to security concerns. '
          'Please contact customer support.',
        );
        break;
      case 'FRAUD_RISK_MEDIUM':
        _showInfoDialog(
          'Your transaction is being processed. '
          'It may be subject to additional verification.',
        );
        break;
      default:
        _showErrorDialog(errorMessage ?? 'Transaction failed. Please try again.');
    }
  }

  void _showSuccessDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Success'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop(); // Go back
            },
            child: Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Error'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Transfer Money')),
      body: Form(
        key: _formKey,
        child: Padding(
          padding: EdgeInsets.all(16.0),
          child: Column(
            children: [
              TextFormField(
                controller: _fromAccountController,
                decoration: InputDecoration(labelText: 'From Account'),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter account number';
                  }
                  return null;
                },
              ),
              TextFormField(
                controller: _toAccountController,
                decoration: InputDecoration(labelText: 'To Account'),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter recipient account';
                  }
                  return null;
                },
              ),
              TextFormField(
                controller: _amountController,
                decoration: InputDecoration(labelText: 'Amount'),
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter amount';
                  }
                  return null;
                },
              ),
              SizedBox(height: 20),
              ElevatedButton(
                onPressed: _isLoading ? null : _handleTransfer,
                child: _isLoading
                    ? CircularProgressIndicator()
                    : Text('Transfer'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
*/

export default TransferScreen;

