# BarangayCare

**Integrated Barangay Health Information Management System with Resident Profiling and Appointment-Based Queue Management**

BarangayCare is a web-based application designed to help barangay health centers manage resident information, appointments, and queue operations.

## Features

- Resident registration and login
- Resident profile management
- Administrator dashboard
- Resident profiling
- Appointment requests and management
- Appointment-based queue management
- Queue calling system
- Notification system
- SQLite database integration

## Technologies Used

- HTML
- CSS
- JavaScript
- Node.js
- SQLite

## Requirements

Before installing BarangayCare, download and install:

1. [Node.js](https://nodejs.org/) (version 22.13.0 or newer recommended)
2. [Visual Studio Code](https://code.visualstudio.com/)
3. [Git](https://git-scm.com/) (optional)

After installing Node.js, open a terminal and verify:

```bash
node -v
npm -v
```

## Installation Guide

### 1. Download the Project

Clone the repository:

```bash
git clone https://github.com/georgeyunson20gwaposodsako/barangaycare.git
```

Alternatively, download the repository as a ZIP file from GitHub and extract it.

### 2. Open the Project Folder

Open the BarangayCare folder using Visual Studio Code.

### 3. Install Dependencies

Open the VS Code terminal inside the project folder.

```bash
npm install
```

BarangayCare currently uses Node.js built-in modules, so no additional npm packages are required.

### 4. Start the Application

Run:

```bash
npm start
```

Alternatively:

```bash
node server.js
```

### 5. Access the System

Open your web browser and visit:

```text
http://localhost:3000
```

Keep the terminal running while using the application.

## Administrator Account Setup

To create an administrator account, open another terminal inside the project folder and run:

```bash
node create-admin.js barangayadmin Admin12345 "Barangay Administrator"
```

You may replace the username, password, and full name with your own credentials.

Use a secure password and keep your administrator credentials private.

## Important Notes

- Do not open HTML files directly from your computer.
- Always access the application through `http://localhost:3000`.
- The application uses SQLite for database storage.
- GitHub is used to store the project source code; it does not automatically host the running application.
- For online access, the Node.js backend and database must be deployed to a suitable hosting environment.

## Developer

-CyberCrew Inc.
BSIT 3E  
St. Cecilia's College Cebu