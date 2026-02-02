-- Database Export for hospital_db
-- Generated at 2026-02-01T20:36:15.596Z

SET FOREIGN_KEY_CHECKS=0;
SET TIME_ZONE = '+00:00';

-- Table structure for table `dailyexpenses`
DROP TABLE IF EXISTS `dailyexpenses`;
CREATE TABLE `dailyexpenses` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Description` text COLLATE utf8mb4_unicode_ci,
  `Category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Amount` decimal(10,2) DEFAULT '0.00',
  `PaymentMethod` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedBy` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `dailyexpenses`
INSERT INTO `dailyexpenses` (`ID`, `Date`, `Description`, `Category`, `Amount`, `PaymentMethod`, `CreatedBy`, `CreatedAt`) VALUES ('EXP-1769673791113', '2026-01-29', 'Expense For Buy A Car', 'Maintenance', '1200.00', 'Cash', 'Admin', '2026-01-29 08:03:11'),
('EXP-1769674915286', '2026-01-29', 'Roti', 'Utilities', '12000.00', 'Cash', 'Admin', '2026-01-29 08:21:55'),
('EXP-1769707492633', '2026-01-29', 'Rotian', 'Utilities', '200.00', 'Cash', 'Admin', '2026-01-29 17:24:53');

-- Table structure for table `labresults`
DROP TABLE IF EXISTS `labresults`;
CREATE TABLE `labresults` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `PatientID` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PatientName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PatientAge` int DEFAULT NULL,
  `TestDate` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ReportDate` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Tests` text COLLATE utf8mb4_unicode_ci,
  `Notes` text COLLATE utf8mb4_unicode_ci,
  `Technician` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Sample Collected',
  `NotifiedAt` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CollectedAt` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `labresults`
INSERT INTO `labresults` (`ID`, `PatientID`, `PatientName`, `PatientAge`, `TestDate`, `ReportDate`, `Tests`, `Notes`, `Technician`, `Status`, `NotifiedAt`, `CollectedAt`, `CreatedAt`) VALUES ('LAB-848834H', 'PAT-MKXPS60Z', 'Created By Sarah', 20, '2026-01-28', '2026-01-28', '[{"name":"Total Cholesterol","value":"300","unit":"mg/dL","normalRange":"< 200","status":"Normal"}]', '', 'Aqsa', 'Notified', '2026-01-29T11:26:35.626Z', NULL, '2026-01-28 08:37:10'),
('LAB-5057GCB', 'PAT-MKY8NNR8', 'Fareeha', 33, '2026-01-31', '2026-01-28', '[{"name":"Total Cholesterol","value":"119","unit":"mg/dL","normalRange":"< 200","status":"High"}]', '', 'Ahmed', 'Sample Collected', NULL, NULL, '2026-01-28 17:42:27'),
('LAB-26005XR', 'PAT-ML3IAWBN', 'Mujtaba Zafar', 23, '2026-02-01', '2026-02-01', '[{"name":"Blood Sugar (Fasting)","value":"140","unit":"mg/dL","normalRange":"70-100","status":"Low"}]', '', 'Mujtuba', 'Notified', '2026-02-01T09:04:18.857Z', NULL, '2026-02-01 09:03:42');

-- Table structure for table `patients`
DROP TABLE IF EXISTS `patients`;
CREATE TABLE `patients` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `MRN` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Age` int DEFAULT NULL,
  `Gender` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Address` text COLLATE utf8mb4_unicode_ci,
  `VisitDate` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Symptoms` text COLLATE utf8mb4_unicode_ci,
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `CreatedBy` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedByRole` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `patients`
INSERT INTO `patients` (`ID`, `MRN`, `Name`, `Age`, `Gender`, `Phone`, `Address`, `VisitDate`, `Symptoms`, `CreatedAt`, `CreatedBy`, `CreatedByRole`) VALUES ('PAT-MKV9CPG8', 'PAT-MKV9CPG8', 'Test', 12, 'Female', '03001234567', 'iSLAMABAD', '2026-01-26', 'TEST', '2026-01-26 19:23:37', NULL, NULL),
('PAT-MKTS8R8S', 'PAT-MKTS8R8S', 'Test123', 12, 'Female', '1222222', '1222', '2026-01-25', '122', '2026-01-25 13:36:54', NULL, NULL),
('PAT-MKTSGOSZ', 'PAT-MKTSGOSZ', 'Test Patient 3', 12, 'Male', '03001120091', 'California', '2026-01-25', '', '2026-01-25 13:43:04', NULL, NULL),
('PAT-MKTTVV3J', 'PAT-MKTTVV3J', 'test', 12, 'Male', '03101234567', 'Oficers Colony', '2026-01-25', 'Virl infection', '2026-01-25 14:22:51', NULL, NULL),
('PAT-MKTWBUYX', 'PAT-MKTWBUYX', 'tesr', 12, 'Female', '03121234567', 'lalazar', '2026-01-25', '', '2026-01-25 15:31:17', NULL, NULL),
('PAT-MKU358XD', 'PAT-MKU358XD', 'New Patient After', 90, 'Male', '03001234567', 'Officers Colony', '2026-01-25', 'SymTopms', '2026-01-25 18:42:06', NULL, NULL),
('PAT-MKU4GNFX', 'PAT-MKU4GNFX', 'Tester', 12, 'Female', '03001234567', '', '2026-01-25', '', '2026-01-25 19:18:57', NULL, NULL),
('PAT-MKV4X94P', 'PAT-MKV4X94P', 'Ashafaq', 122, 'Male', '020012333u', 'Islamabad', '2026-01-26', '', '2026-01-26 12:19:38', NULL, NULL),
('PAT-MKXPS60Z', 'PAT-MKXPS60Z', 'Created By Sarah', 20, 'Female', '03211234567', 'Basti Qabarastan Road', '2026-01-28', 'Test', '2026-01-28 07:39:05', NULL, NULL),
('PAT-MKXRZO97', 'PAT-MKXRZO97', 'Abdullah Shahid', 30, 'Male', '03335156641', 'Officer''s Colony', '2026-01-28', 'Test Symptoms', '2026-01-28 08:40:55', NULL, NULL),
('PAT-MKXMG1TS', 'PAT-MKXMG1TS', 'Aqsa Shahid', 21, 'Female', '030012345678', 'Wah Cantt', '2026-01-28', '', '2026-01-28 06:05:41', NULL, NULL),
('PAT-MKXSMM41', 'PAT-MKXSMM41', 'Shahid Younas', 60, 'Male', '03335156642', 'Wah Cantt', '2026-01-28', 'Test', '2026-01-28 08:58:45', 'System Admin', 'Admin'),
('PAT-MKXSYT67', 'PAT-MKXSYT67', 'Dilshad Shahid', 70, 'Female', '03211558911', 'Officers Colony', '2026-01-28', '', '2026-01-28 09:08:14', 'Sarah', 'Receptionist'),
('PAT-MKXXG6DM', 'PAT-MKXXG6DM', 'test123', 12, 'Male', '03001234567', '', '2026-01-28', '', '2026-01-28 11:13:43', 'System Admin', 'Admin'),
('PAT-MKXXQ77Z', 'PAT-MKXXQ77Z', 'Iqra Ahmed', 28, 'Female', '03001234567', 'Basti Qabarastan Road', '2026-01-28', 'Systoms', '2026-01-28 11:21:30', 'System Admin', 'Admin'),
('PAT-MKXY4B5U', 'PAT-MKXY4B5U', 'Hafiz Naveed Ul Hassan', 35, 'Male', '03001234567', 'Gujrat, Pakistan', '2026-01-28', '', '2026-01-28 11:32:29', 'System Admin', 'Admin'),
('PAT-MKXYBH5E', 'PAT-MKXYBH5E', 'Abdul Qayyum', 28, 'Male', '03001234567', 'Gujrat', '2026-01-28', 'symtoms', '2026-01-28 11:38:03', 'System Admin', 'Admin'),
('PAT-MKXYJC8I', 'PAT-MKXYJC8I', 'Samiya Naveed', 29, 'Female', '03001234567', 'Sialkot', '2026-01-28', 'symtoms', '2026-01-28 11:44:10', 'System Admin', 'Admin'),
('PAT-MKY157HQ', 'PAT-MKY157HQ', 'Ayesha Sadiqa', 20, 'Female', '03001234567', 'Gujrat', '2026-01-28', 'Pakistan', '2026-01-28 12:57:09', 'System Admin', 'Admin'),
('PAT-MKY1BP0G', 'PAT-MKY1BP0G', 'Muqaddas Mobeen', 29, 'Female', '03001234567', 'Gujrat Pakistan', '2026-01-28', '', '2026-01-28 13:02:12', 'System Admin', 'Admin'),
('PAT-MKY1S7Z9', 'PAT-MKY1S7Z9', 'Kausar', 70, 'Female', '03001234567', 'Gujrat Pakistan', '2026-01-28', '', '2026-01-28 13:15:03', 'System Admin', 'Admin'),
('PAT-MKY298XC', 'PAT-MKY298XC', 'Mobeen Ahmed', 35, 'Male', '03001234567', 'Gujrat, Pakistan', '2026-01-28', '', '2026-01-28 13:28:18', 'Sarah', 'Receptionist'),
('PAT-MKY8NNR8', 'PAT-MKY8NNR8', 'Fareeha', 33, 'Female', '03001234567', 'Basti', '2026-01-28', 'Symtopms', '2026-01-28 16:27:28', 'System Admin', 'Admin'),
('PAT-ML1CIU7Q', 'PAT-ML1CIU7Q', 'Mobeen Ahmed', 35, 'Male', '03001234567', 'Gujrat, Pakistan', '2026-01-30', '', '2026-01-30 20:39:00', 'System Admin', 'Admin'),
('PAT-A-1769806621828', 'MRN-TEST-1769806621826', 'John MRN Test', 30, 'Male', '555-0101', '123 Test St', '2023-01-01', 'Initial Visit', '2026-01-30 20:57:02', 'Test Script', 'Admin'),
('PAT-B-1769806621910', 'MRN-TEST-1769806621826', 'John MRN Test', 30, 'Male', '555-0101', '123 Test St', '2023-02-01', 'Follow-up', '2026-01-30 20:57:02', 'Test Script', 'Admin'),
('PAT-ML1D98WN', 'PAT-MKXMG1TS', 'Aqsa Shahid', 21, 'Female', '030012345678', 'Wah Cantt', '2026-01-30', '', '2026-01-30 20:59:32', 'System Admin', 'Admin'),
('PAT-ML1E4RJB', 'PAT-MKXMG1TS', 'Aqsa Shahid', 21, 'Female', '030012345678', 'Wah Cantt', '2026-01-30', '', '2026-01-30 21:24:02', 'System Admin', 'Admin'),
('PAT-ML1E6OXY', 'PAT-MKXMG1TS', 'Aqsa Shahid', 21, 'Female', '030012345678', 'Wah Cantt', '2026-01-30', '', '2026-01-30 21:25:32', 'System Admin', 'Admin'),
('PAT-ML1WK268', 'PAT-ML1WK268', 'Umer Younas', 40, 'Male', '03001209112', 'Basti , Qabarastan Road', '2026-01-31', '', '2026-01-31 05:59:49', 'System Admin', 'Admin'),
('PAT-ML3HOJD3', 'PAT-MKTTVV3J', 'test', 12, 'Male', '03101234567', 'Oficers Colony', '2026-02-01', '', '2026-02-01 08:38:56', 'System Admin', 'Admin'),
('PAT-ML3IAWBN', 'PAT-ML3IAWBN', 'Mujtaba Zafar', 23, 'Male', '03200978264', 'Basti', '2026-02-01', 'Viral Infection', '2026-02-01 08:56:19', 'System Admin', 'Admin');

-- Table structure for table `patientservices`
DROP TABLE IF EXISTS `patientservices`;
CREATE TABLE `patientservices` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `PatientID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Services` text COLLATE utf8mb4_unicode_ci,
  `GrandTotal` decimal(10,2) DEFAULT '0.00',
  `Status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Draft',
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `patientservices`
INSERT INTO `patientservices` (`ID`, `PatientID`, `Services`, `GrandTotal`, `Status`, `CreatedAt`, `UpdatedAt`) VALUES ('SRV-MKY1SKVJ', 'PAT-MKY1S7Z9', '{"consultation":{"enabled":true,"type":"General","doctorName":"Dr Aqsa","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-28T13:15:03.209Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-28"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-01-28 13:15:20', '2026-01-28 13:15:20'),
('SRV-MKY1T61X', 'PAT-MKY1S7Z9', '{"consultation":{"enabled":false,"type":"General","doctorName":"","fee":0},"ultrasound":{"enabled":true,"type":"Abdomen","charges":1200},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-28T13:15:37.172Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-28"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1200.00', 'Completed', '2026-01-28 13:15:47', '2026-01-28 13:15:47'),
('SRV-MKY29U7Y', 'PAT-MKY298XC', '{"consultation":{"enabled":true,"type":"Specialist","doctorName":"Dr Hasnain","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-28T13:28:17.572Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-28"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-01-28 13:28:45', '2026-01-28 13:28:45'),
('SRV-MKY8OG74', 'PAT-MKY8NNR8', '{"consultation":{"enabled":true,"type":"General","doctorName":"Dr Aqsa","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-28T16:27:27.709Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-28"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-01-28 16:28:04', '2026-01-28 16:28:04'),
('SRV-MKY9IMMA', 'PAT-MKY8NNR8', '{"consultation":{"enabled":false,"type":"General","doctorName":"","fee":0},"ultrasound":{"enabled":true,"type":"Abdomen","charges":1200},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-28T16:51:08.398Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-28"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1200.00', 'Completed', '2026-01-28 16:51:32', '2026-01-28 16:51:32'),
('SRV-ML1CJCTO', 'PAT-ML1CIU7Q', '{"consultation":{"enabled":true,"type":"Specialist","doctorName":"Dr Aqsa","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-30T20:38:59.822Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-30"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-01-30 20:39:24', '2026-01-30 20:39:24'),
('SRV-ML1D9LJR', 'PAT-ML1D98WN', '{"consultation":{"enabled":true,"type":"Specialist","doctorName":"Test ","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-30T20:59:31.873Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-30"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-01-30 20:59:48', '2026-01-30 20:59:48'),
('SRV-ML1E56LY', 'PAT-ML1E4RJB', '{"consultation":{"enabled":true,"type":"General","doctorName":"Dr Aqsa","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-30T21:24:02.383Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-30"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-01-30 21:24:22', '2026-01-30 21:24:22'),
('SRV-ML1E754M', 'PAT-ML1E6OXY', '{"consultation":{"enabled":true,"type":"General","doctorName":"Dr Aqsa","fee":1200},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-30T21:25:32.332Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-30"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1200.00', 'Completed', '2026-01-30 21:25:53', '2026-01-30 21:25:53'),
('SRV-ML1WKF93', 'PAT-ML1WK268', '{"consultation":{"enabled":true,"type":"Specialist","doctorName":"Dr Aqsa","fee":1200},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-01-31T05:59:49.103Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-01-31"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1200.00', 'Completed', '2026-01-31 06:00:06', '2026-01-31 06:00:06'),
('SRV-ML3HPVKE', 'PAT-ML3HOJD3', '{"consultation":{"enabled":true,"type":"General","doctorName":"Dr Aqsa","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-02-01T08:38:56.122Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-02-01"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-02-01 08:39:58', '2026-02-01 08:39:58'),
('SRV-ML3IB99F', 'PAT-ML3IAWBN', '{"consultation":{"enabled":true,"type":"General","doctorName":"Dr Aqsa","fee":1000},"ultrasound":{"enabled":false,"type":"Abdomen","charges":0},"ecg":{"enabled":false,"type":"Resting","charges":0},"bpReading":{"enabled":false,"systolic":0,"diastolic":0,"pulse":0,"recordedAt":"2026-02-01T08:56:19.377Z"},"injection":{"enabled":false,"type":"IM","name":"","quantity":1,"charges":0},"retention":{"enabled":false,"duration":"","charges":0},"surgery":{"enabled":false,"type":"Normal","surgeonName":"","operationCharges":0,"otCharges":0,"anesthesiaCharges":0,"surgeryDate":"2026-02-01"},"feeCollection":{"labFee":0,"medicines":[],"paymentMode":"Cash"}}', '1000.00', 'Completed', '2026-02-01 08:56:36', '2026-02-01 08:56:36');

-- Table structure for table `payments`
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `PatientID` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PatientName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ConsultationFee` decimal(10,2) DEFAULT '0.00',
  `LabFee` decimal(10,2) DEFAULT '0.00',
  `MedicineFee` decimal(10,2) DEFAULT '0.00',
  `TotalAmount` decimal(10,2) DEFAULT '0.00',
  `PaymentMode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Medicines` text COLLATE utf8mb4_unicode_ci,
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `payments`
INSERT INTO `payments` (`ID`, `PatientID`, `PatientName`, `ConsultationFee`, `LabFee`, `MedicineFee`, `TotalAmount`, `PaymentMode`, `Medicines`, `CreatedAt`) VALUES ('PAY-9712TBZ', 'PAT-MKY1S7Z9', 'Kausar', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-01-28 13:15:20'),
('PAY-5722PAZ', 'PAT-MKY1S7Z9', 'Kausar', '0.00', '0.00', '0.00', '1200.00', 'Cash', '[]', '2026-01-28 13:15:47'),
('PAY-9589OMO', 'PAT-MKY298XC', 'Mobeen Ahmed', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-01-28 13:28:45'),
('PAY-7906P8I', 'PAT-MKY8NNR8', 'Fareeha', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-01-28 16:28:05'),
('PAY-61870VQ', 'PAT-MKY8NNR8', 'Fareeha', '0.00', '0.00', '0.00', '1200.00', 'Cash', '[]', '2026-01-28 16:51:33'),
('PAY-41318HK', 'PAT-ML1CIU7Q', 'Mobeen Ahmed', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-01-30 20:39:24'),
('PAY-5091L4B', 'PAT-ML1D98WN', 'Aqsa Shahid', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-01-30 20:59:48'),
('PAY-9047MCO', 'PAT-ML1E4RJB', 'Aqsa Shahid', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-01-30 21:24:22'),
('PAY-5879WFV', 'PAT-ML1E6OXY', 'Aqsa Shahid', '1200.00', '0.00', '0.00', '1200.00', 'Cash', '[]', '2026-01-30 21:25:53'),
('PAY-3717CIR', 'PAT-ML1WK268', 'Umer Younas', '1200.00', '0.00', '0.00', '1200.00', 'Cash', '[]', '2026-01-31 06:00:06'),
('PAY-9360V1D', 'PAT-ML3HOJD3', 'test', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-02-01 08:39:59'),
('PAY-5802CO9', 'PAT-ML3IAWBN', 'Mujtaba Zafar', '1000.00', '0.00', '0.00', '1000.00', 'Cash', '[]', '2026-02-01 08:56:36');

-- Table structure for table `prescriptionmedicines`
DROP TABLE IF EXISTS `prescriptionmedicines`;
CREATE TABLE `prescriptionmedicines` (
  `ID` int NOT NULL AUTO_INCREMENT,
  `PrescriptionID` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `MedicineName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Dosage` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Frequency` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Quantity` int DEFAULT '1',
  PRIMARY KEY (`ID`),
  KEY `PrescriptionID` (`PrescriptionID`)
) ENGINE=MyISAM AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `prescriptionmedicines`
INSERT INTO `prescriptionmedicines` (`ID`, `PrescriptionID`, `MedicineName`, `Category`, `Dosage`, `Frequency`, `Duration`, `Quantity`) VALUES (3, 'RX-TEST-1769762806382', 'Paracetamol', NULL, '650mg', 'Thrice daily', '3 days', 9),
(5, 'RX-4365CT6', 'Paracetamol', NULL, '650mg', 'Before meals', '10 days', 1),
(11, 'RX-5787QAG', 'ceftriaxon', NULL, '100mg', 'Once daily', '3 days', 1),
(9, NULL, 'ceftriaxon', NULL, '500mg', 'Every 8 hours', '5 days', 1),
(12, NULL, 'Paracetamol', 'Syrup', '', '', '', 1),
(13, 'RX-444036M', 'Paracetamol', NULL, '5ml', 'Before meals', '14 days', 1),
(14, 'RX-47281CK', 'Paracetamol', NULL, '650mg', 'Every 6 hours', '1 month', 1),
(15, 'RX-4257QV2', 'Paracetamol', NULL, '500mg', 'Thrice daily', '21 days', 1),
(16, 'RX-4509G8N', 'Paracetamol', NULL, '650mg', 'Every 8 hours', '14 days', 1),
(18, 'RX-3364MMQ', 'Paracetamol', NULL, '250mg', 'Twice daily', '5 days', 1),
(19, 'RX-5098R3B', 'Paracetamol', NULL, '650mg', 'Thrice daily', '10 days', 1);

-- Table structure for table `prescriptions`
DROP TABLE IF EXISTS `prescriptions`;
CREATE TABLE `prescriptions` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `PatientID` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PatientName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `PatientAge` int DEFAULT NULL,
  `Diagnosis` text COLLATE utf8mb4_unicode_ci,
  `Medicines` text COLLATE utf8mb4_unicode_ci,
  `LabTests` text COLLATE utf8mb4_unicode_ci,
  `DoctorNotes` text COLLATE utf8mb4_unicode_ci,
  `Precautions` text COLLATE utf8mb4_unicode_ci,
  `GeneratedText` text COLLATE utf8mb4_unicode_ci,
  `FollowUpDate` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'Finalized',
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `prescriptions`
INSERT INTO `prescriptions` (`ID`, `PatientID`, `PatientName`, `PatientAge`, `Diagnosis`, `Medicines`, `LabTests`, `DoctorNotes`, `Precautions`, `GeneratedText`, `FollowUpDate`, `CreatedAt`, `Status`) VALUES ('RX-4509G8N', 'PAT-ML1WK268', 'Umer Younas', 40, 'Viral Infection ', '[]', '["Blood Test"]', 'Rest Hydration ', 'Avoid Cold Drinks ', 'Patient Umer Younas (Age 40) diagnosed with Viral Infection . Prescribed Paracetamol 650mg Every 8 hours for 14 days. Advised Blood Test. General advice: Rest Hydration . Precautions: Avoid Cold Drinks .', '2026-02-05', '2026-01-31 06:01:31', 'Draft'),
('RX-4257QV2', 'PAT-MKY8NNR8', 'Fareeha', 33, 'Viral Infection ', '[]', '["Blood Test"]', 'Rest Hydration ', 'Avoid Cold Drinks ', 'Patient Fareeha (Age 33) diagnosed with Viral Infection . Prescribed Paracetamol 500mg Thrice daily for 21 days. Advised Blood Test. General advice: Rest Hydration . Precautions: Avoid Cold Drinks .', '2026-02-03', '2026-01-30 20:25:23', 'Finalized'),
('RX-47281CK', 'PAT-MKY298XC', 'Mobeen Ahmed', 35, 'Viral Infection ', '[]', '["Blood Test"]', 'Rest Hydration', 'Avoid Cold Drinks ', 'Patient Mobeen Ahmed (Age 35) diagnosed with Viral Infection . Prescribed Paracetamol 650mg Every 6 hours for 1 month. Advised Blood Test. General advice: Rest Hydration. Precautions: Avoid Cold Drinks .', '2026-02-03', '2026-01-30 20:23:57', 'Finalized'),
('RX-444036M', 'PAT-MKY298XC', 'Mobeen Ahmed', 35, 'Viral Infection ', '[]', '["X Rays"]', 'Rest Hydration ', 'Avoid Cold Drinks ', 'Patient Mobeen Ahmed (Age 35) diagnosed with Viral Infection . Prescribed Paracetamol 5ml Before meals for 14 days. Advised X Rays. General advice: Rest Hydration . Precautions: Avoid Cold Drinks .', '2026-02-01', '2026-01-30 20:22:42', 'Finalized'),
('RX-4365CT6', 'PAT-MKY8NNR8', 'Fareeha', 33, 'Viral Infection', '[]', '[]', 'Rest', 'Avoid Cold Drinks', 'Patient Fareeha (Age 33) diagnosed with Viral Infection. Prescribed Paracetamol 650mg Before meals for 10 days.  General advice: Rest. Precautions: Avoid Cold Drinks.', '2026-01-31', '2026-01-30 14:58:58', 'Finalized'),
('RX-5787QAG', 'PAT-MKY8NNR8', 'Fareeha', 33, 'viral inf', '[]', '["Blood Test"]', '', '', 'Patient Fareeha (Age 33) diagnosed with viral inf. Prescribed ceftriaxon 100mg Once daily for 3 days. Advised Blood Test.', '2026-02-06T00:00:00.000Z', '2026-01-30 17:35:22', 'Finalized'),
('RX-TEST-1769762806382', 'P-001', 'Test Patient', 35, 'Common Cold - Updated', '[]', '["Blood Test"]', 'Rest and hydration', 'Avoid cold drinks', 'Test prescription', '2026-02-06', '2026-01-30 08:46:46', 'Finalized'),
('RX-TEST-1769762445696', 'P-001', 'Test Patient', 35, 'Common Cold - Updated', '[]', '["Blood Test"]', 'Rest and hydration', 'Avoid cold drinks', 'Test prescription', '2026-02-06', '2026-01-30 08:40:46', 'Finalized'),
('RX-6321B3I', 'PAT-MKY8NNR8', 'Fareeha', 33, 'Viral Infection', '[]', '["Blood Test"]', 'Rest', 'Avoid Cold Drinks ', 'Patient Fareeha (Age 33) diagnosed with Viral Infection. Prescribed Brufen 650mg Every 6 hours for 21 days. Advised Blood Test. General advice: Rest. Precautions: Avoid Cold Drinks .', '2026-01-31', '2026-01-30 08:42:40', 'Finalized'),
('RX-4624SBW', 'PAT-MKY8NNR8', 'Fareeha', 33, 'Viral Infection', '[{"name":"Paracetamol","dosage":"100mg","frequency":"Once daily","duration":"7 days"}]', '["Blood Test"]', 'Rest ', 'Avoid Cold Drinks ', 'Patient Fareeha (Age 33) diagnosed with Viral Infection. Prescribed Paracetamol 100mg Once daily for 7 days. Advised Blood Test. General advice: Rest . Precautions: Avoid Cold Drinks .', '2026-01-31', '2026-01-30 08:11:51', 'Finalized'),
('RX-5091PZ0', 'PAT-MKY8NNR8', 'Fareeha', 33, 'Infection ', '[{"name":"Paracetamol","dosage":"50mg","frequency":"Twice daily","duration":"3 days"}]', '[]', 'Rest Hydration ', 'Cold Drinks ', 'Patient Fareeha (Age 33) diagnosed with Infection . Prescribed Paracetamol 50mg Twice daily for 3 days.  General advice: Rest Hydration . Precautions: Cold Drinks .', '2026-02-01', '2026-01-29 20:03:53', 'Finalized'),
('RX-28675RF', 'PAT-MKY1BP0G', 'Muqaddas Mobeen', 29, 'Viral Indection ', '[{"name":"Paracetamol","dosage":"650mg","frequency":"Every 8 hours","duration":"2 months"}]', '["X-Rays"]', 'Rest ', 'Avoid Cold Drinks ', 'Patient Muqaddas Mobeen (Age 29) diagnosed with Viral Indection . Prescribed Paracetamol 650mg Every 8 hours for 2 months. Advised X-Rays. General advice: Rest . Precautions: Avoid Cold Drinks .', '2026-01-31', '2026-01-29 19:52:44', 'Finalized'),
('RX-3465558', 'PAT-MKY1S7Z9', 'Kausar', 70, 'Viral Infection ', '[{"name":"Paracetamol","dosage":"1g","frequency":"Before meals","duration":"1 month"}]', '["Blood Test"]', 'Rest Hydration ', '', 'Patient Kausar (Age 70) diagnosed with Viral Infection . Prescribed Paracetamol 1g Before meals for 1 month. Advised Blood Test. General advice: Rest Hydration .', '2026-02-12', '2026-01-29 19:54:39', 'Finalized'),
('RX-3788ZI6', 'PAT-MKY298XC', 'Mobeen Ahmed', 35, 'Viral Infection ', '[{"name":"Paracetamol","dosage":"5ml","frequency":"Before meals","duration":"14 days"}]', '["Blood Test"]', 'Rest ', 'Avoid Cold Drinks ', 'Patient Mobeen Ahmed (Age 35) diagnosed with Viral Infection . Prescribed Paracetamol 5ml Before meals for 14 days. Advised Blood Test. General advice: Rest . Precautions: Avoid Cold Drinks .', '2026-02-13', '2026-01-29 19:49:33', 'Finalized'),
('RX-8940NMR', 'PAT-MKY298XC', 'Mobeen Ahmed', 35, 'Fever', '[{"name":"Paracetamol","dosage":"500mg","frequency":"Twice daily","duration":"7 days"}]', '["Blood Test"]', 'Rest ', 'Avoid Cold Drinks ', 'Patient Mobeen Ahmed (Age 35) diagnosed with Fever. Prescribed Paracetamol 500mg Twice daily for 7 days. Advised Blood Test. General advice: Rest . Precautions: Avoid Cold Drinks .', '2026-02-11', '2026-01-29 19:22:36', 'Finalized'),
('RX-8251EBZ', 'PAT-MKY8NNR8', 'Fareeha', 33, 'Viral Infection ', '[{"name":"Paracetamol","dosage":"1g","frequency":"Every 8 hours","duration":"14 days"}]', '["X- Rays"]', 'Rest , Hydration ', 'Avoid Cold Drinks ', 'Patient Fareeha (Age 33) diagnosed with Viral Infection . Prescribed Paracetamol 1g Every 8 hours for 14 days. Advised X- Rays. General advice: Rest , Hydration . Precautions: Avoid Cold Drinks .', '2026-02-03T00:00:00.000Z', '2026-01-29 19:21:38', 'Finalized'),
('RX-3364MMQ', 'PAT-ML3IAWBN', 'Mujtaba Zafar', 23, 'Viral Infection', '[]', '["Blood Test","X-Rays"]', 'Rest Hydration', 'Avoid Cold drinks', 'Patient Mujtaba Zafar (Age 23) diagnosed with Viral Infection. Prescribed Paracetamol 250mg Twice daily for 5 days. Advised Blood Test, X-Rays. General advice: Rest Hydration. Precautions: Avoid Cold drinks.', '2026-02-04', '2026-02-01 09:00:58', 'Finalized'),
('RX-5098R3B', 'PAT-ML3IAWBN', 'Mujtaba Zafar', 23, 'Viral Infection', '[]', '["Blood Test"]', 'Rest Hydration', 'Avoid Cold Drinks ', 'Patient Mujtaba Zafar (Age 23) diagnosed with Viral Infection. Prescribed Paracetamol 650mg Thrice daily for 10 days. Advised Blood Test. General advice: Rest Hydration. Precautions: Avoid Cold Drinks .', '2026-02-04', '2026-02-01 09:29:46', 'Finalized');

-- Table structure for table `stock`
DROP TABLE IF EXISTS `stock`;
CREATE TABLE `stock` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Quantity` int DEFAULT '0',
  `Price` decimal(10,2) DEFAULT '0.00',
  `LowStockThreshold` int DEFAULT '10',
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `stock`
INSERT INTO `stock` (`ID`, `Name`, `Category`, `Quantity`, `Price`, `LowStockThreshold`, `CreatedAt`) VALUES ('STK-6518CT0', 'Paracetamol', 'Tablet', 0, '0.00', 20, '2026-01-30 14:56:51'),
('STK-9082ILO', 'Dispirin', 'Syrup', 1200, '30.00', 20, '2026-01-30 15:14:41');

-- Table structure for table `users`
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `ID` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `Role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Receptionist',
  `IsActive` tinyint(1) DEFAULT '1',
  `CreatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `Permissions` text COLLATE utf8mb4_unicode_ci,
  `CreatedBy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `UpdatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `LastLogin` datetime DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Username` (`Username`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table `users`
INSERT INTO `users` (`ID`, `Username`, `Password`, `Name`, `Role`, `IsActive`, `CreatedAt`, `Email`, `Phone`, `Permissions`, `CreatedBy`, `UpdatedAt`, `LastLogin`) VALUES ('USR-001', 'receptionist', 'reception123', 'Front Desk', 'Receptionist', 1, '2026-01-26 19:21:49', NULL, NULL, '["view_patients","edit_patients","view_payments","create_payments","manage_stock"]', NULL, '2026-01-28 12:35:44', NULL),
('USR-002', 'doctor', 'doctor123', 'Dr. Admin', 'Doctor', 1, '2026-01-26 19:21:49', NULL, NULL, '["view_patients","edit_patients","view_prescriptions","create_prescriptions","view_lab_results","view_medicines"]', NULL, '2026-01-29 13:10:35', '2026-01-29 08:10:35'),
('USR-003', 'labtech', 'lab123', 'Lab Technician', 'LabTech', 1, '2026-01-26 19:21:49', NULL, NULL, '["view_medicines","edit_lab_results","view_lab_results"]', NULL, '2026-01-28 13:53:12', '2026-01-28 08:53:12'),
('USR-000', 'admin', 'admin123', 'System Admin', 'Admin', 1, '2026-01-28 07:11:12', NULL, NULL, '["view_patients","edit_patients","delete_patients","view_payments","create_payments","view_lab_results","edit_lab_results","view_prescriptions","create_prescriptions","view_reports","manage_users","manage_stock"]', 'SYSTEM', '2026-02-01 13:36:59', '2026-02-01 08:37:00'),
('USR-MKXOWKZG', 'Sarah', 'Test123@#', 'Sarah', 'Receptionist', 1, '2026-01-28 07:14:32', 'ahmed@yopmail.com', '03001234567', '["view_payments","view_patients"]', 'SYSTEM', '2026-01-28 20:08:41', '2026-01-28 15:08:42'),
('USR-MKXQAT3W', 'Mohsin', 'lab123', 'Mohsin Ali', 'LabTech', 0, '2026-01-28 07:53:35', 'mohsin123@yopmail.com', '0300123456', '["view_lab_results","edit_lab_results"]', 'USR-002', '2026-01-28 13:03:47', '2026-01-28 08:03:24'),
('USR-MKXRRXDC', 'Shahid', 'Test123@#', 'Aqsa ', 'LabTechnician', 1, '2026-01-28 08:34:53', 'Aqsa', '03001234567', '["view_lab_results","edit_lab_results"]', 'USR-000', '2026-01-28 13:34:53', NULL),
('USR-MKXRTSKT', 'aqsa', 'Test123@#', 'Aqsa', 'LabTechnician', 1, '2026-01-28 08:36:20', 'aqsa@yopmail.com', '03001234567', '["edit_lab_results","view_lab_results"]', 'USR-000', '2026-01-28 13:36:35', '2026-01-28 08:36:35'),
('USR-MKY9N2H7', 'amina', 'Test123@#', 'Amina', 'Receptionist', 1, '2026-01-28 16:55:00', 'amina@yopmail.com', '032156565464', '["edit_patients","view_patients"]', 'USR-000', '2026-01-28 21:55:27', '2026-01-28 16:55:28'),
('USR-MKY5NBII', 'Bilal', 'Test123@#', 'Mohsin Bilal ', 'LabTechnician', 1, '2026-01-28 15:03:13', 'bilal@yopmail.com', '03211558911', '["view_lab_results","view_patients","edit_patients"]', 'USR-MKXOWKZG', '2026-01-28 20:05:36', '2026-01-28 15:05:36');

SET FOREIGN_KEY_CHECKS=1;
