# SpacetimeDB Demo: Real-Time Deposits & Packages Application

This repository contains a demonstration application built using SpacetimeDB to showcase real-time data synchronization for a logistics scenario involving deposits, packages, and articles. Users can create shipment orders and monitor package statuses as they update instantly across all connected clients.

## Architecture Overview

The application follows a multi-component architecture:

* **Backend (`SpacetimeDB`)**: Serves as both the database and the server-side logic engine.
    * A module written in C# defines the data schema (tables) and business logic (reducers).
    * Tables include `Deposit`, `Package`, `Article`, and `TransportLog`.
    * Leverages SpacetimeDB's real-time subscription feature to automatically push data changes to connected clients, ensuring any state change is reflected instantly on the frontend.

* **Local C# Service (Worker - Optional)**: A supporting `.NET` service responsible for simulating time-based events.
    * Monitors new package travel orders.
    * Updates package status over time (e.g., changing state from `Preparing` to `On The Way`).
    * Uses the SpacetimeDB client SDK to subscribe to data changes and call reducers (server functions) to modify the application state.

* **Frontend (`React` + `BlueprintJS`)**: A single-page web application providing the user interface.
    * Allows users to create orders and monitor package delivery status in real-time.
    * Connects to SpacetimeDB via WebSockets.
    * Subscribes to the `Deposit` and `Package` tables for live updates.
    * Uses `BlueprintJS` components for a clean and interactive experience (e.g., dropdowns for selecting deposits, buttons to dispatch orders, dynamic displays of package status).

## SpacetimeDB Schema and Data Model

The core data model is defined within the SpacetimeDB C# module using the following tables:

### `Deposit`
* Represents a depot or location.
* Manages package inventory and outgoing shipments.
* **Fields:**
    * `PackagesOnSite`: List of package IDs (`string`) currently at this deposit.
    * `OutgoingPackageIds`: List of package IDs (`string`) scheduled to be sent from this deposit.

### `Package`
* Represents a shipment container.
* **Fields:**
    * `Id`: Unique identifier for the package (e.g., `string` code).
    * `MaxLoad`: Capacity of the package.
    * `Contents`: List of article IDs (`string`) contained within the package.
    * `State`: Current status of the package (e.g., `Preparing`, `Prepared`, `OnTheWay`, `AtDestination`).
    * `SourceDeposit`: ID of the origin deposit.
    * `DestinationDeposit`: ID of the destination deposit.

### `Article`
* Represents an individual item or article that can be shipped.
* **Fields:**
    * `ArticleId`: Unique identifier for the article (`string`).
    * `CurrentDeposit`: ID of the deposit where the article currently resides.
    * `Status`: Current state of the article (e.g., `in_stock`, `in_transit`, `processing`, `delivered`). Articles begin in `in_stock` status at a deposit.

### `TransportLog`
* Provides a log of package movements for audit and analytics purposes.
* **Fields:**
    * `PackageId`: ID of the package being moved.
    * `FromDeposit`: ID of the source deposit.
    * `ToDeposit`: ID of the destination deposit.
    * `Timestamp`: Time when the transport was initiated.
    * *(Note: For simplicity in this demo, one log entry is created per package shipment when the shipment is initiated.)*

## How it Works

1.  The React frontend connects to SpacetimeDB via WebSockets and subscribes to relevant tables like `Deposit` and `Package`.
2.  Users interact with the UI, for example, creating a new shipment order by selecting articles and a destination deposit.
3.  The frontend invokes *reducers* (server-side functions defined in the SpacetimeDB C# module) to update the state. This might involve creating a new `Package` record, updating the `PackagesOnSite` and `OutgoingPackageIds` lists on the relevant `Deposit` records, changing the `Status` of `Article` records, and adding an entry to the `TransportLog`.
4.  SpacetimeDB processes the state changes and automatically pushes the updated data to all subscribed clients in real-time.
5.  The React frontend receives these updates and re-renders the UI components to reflect the current state instantly (e.g., showing the new package, updating its status).
6.  (If used) The optional C# Worker service also receives relevant data updates. It can react to these changes (e.g., noticing a package is in the `Prepared` state) and trigger further state updates by calling reducers (e.g., changing the package `State` to `OnTheWay` after a simulated travel time).

## Features

* Real-time data synchronization for a logistics tracking scenario.
* Interactive UI for order creation and status monitoring.
* Demonstrates SpacetimeDB as a combined backend database and logic engine.
* Optional simulation component for time-based state changes.
* Clear separation between backend (SpacetimeDB module), frontend (React), and simulation (Worker).

## Technologies Used

* **Backend:** SpacetimeDB, C# (.NET)
* **Frontend:** React, BlueprintJS, WebSockets
* **Simulation (Optional):** C# (.NET), SpacetimeDB Client SDK

## Getting Started

*(Add instructions here on how to clone, configure, build, and run the project.)*

## Contributing

*(Add contribution guidelines here if applicable.)*

## License

*(Add license information here.)*
