import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Card, 
  Elevation, 
  HTMLSelect, 
  ProgressBar, 
  Tag, 
  Navbar, 
  NavbarGroup, 
  NavbarHeading, 
  Divider 
} from "@blueprintjs/core";
import { SpacetimeDBClient } from 'spacetimedb-sdk';
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "./App.css";

function App() {
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [packages, setPackages] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [transportLogs, setTransportLogs] = useState([]);

  useEffect(() => {
    // Connect to SpacetimeDB
    const connectToSpacetimeDB = async () => {
      try {
        const client = await SpacetimeDBClient.connect("ws://localhost:3000/db");
        
        // Subscribe to tables
        await client.subscribe("SELECT * FROM deposit");
        await client.subscribe("SELECT * FROM package");
        await client.subscribe("SELECT * FROM transport_log");
        
        // Set up event handlers
        client.db.deposit.onInsert = (deposit) => {
          setDeposits(prev => [...prev, deposit]);
        };
        
        client.db.deposit.onUpdate = (deposit) => {
          setDeposits(prev => prev.map(d => d.Id === deposit.Id ? deposit : d));
        };
        
        client.db.package.onInsert = (pkg) => {
          setPackages(prev => [...prev, pkg]);
        };
        
        client.db.package.onUpdate = (pkg) => {
          setPackages(prev => prev.map(p => p.Id === pkg.Id ? pkg : p));
        };
        
        client.db.transport_log.onInsert = (log) => {
          setTransportLogs(prev => [...prev, log]);
        };
        
        // Initialize state with current data
        setDeposits(client.db.deposit.getAll());
        setPackages(client.db.package.getAll());
        setTransportLogs(client.db.transport_log.getAll());
        
        setClient(client);
        setConnected(true);
      } catch (error) {
        console.error("Failed to connect to SpacetimeDB:", error);
      }
    };
    
    connectToSpacetimeDB();
    
    return () => {
      // Cleanup on unmount
      if (client) {
        client.disconnect();
      }
    };
  }, []);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!sourceId || !destId || sourceId === destId) {
      alert("Please select different source and destination deposits");
      return;
    }
    
    try {
      await client.reducers.CreateTravelOrder(parseInt(sourceId), parseInt(destId));
      setSourceId("");
      setDestId("");
    } catch (error) {
      console.error("Failed to create travel order:", error);
      alert("Failed to create travel order: " + error.message);
    }
  };

  // Helper to map state to progress fraction
  const stateProgress = (state) => {
    switch(state) {
      case "Preparing": return 0.25;
      case "Prepared": return 0.5;
      case "OnTheWay": return 0.75;
      case "AtDestination": return 1.0;
      default: return 0;
    }
  };
  
  // Helper to map state to intent color
  const stateIntent = (state) => {
    switch(state) {
      case "Preparing": return "none";
      case "Prepared": return "primary";
      case "OnTheWay": return "warning";
      case "AtDestination": return "success";
      default: return "none";
    }
  };

  return (
    <div className="app-container">
      <Navbar>
        <NavbarGroup>
          <NavbarHeading>Lodi Package Tracking</NavbarHeading>
          <Divider />
          <Tag intent={connected ? "success" : "danger"}>
            {connected ? "Connected" : "Disconnected"}
          </Tag>
        </NavbarGroup>
      </Navbar>
      
      <div className="content">
        <div className="section">
          <h2>Create New Travel Order</h2>
          <form onSubmit={handleCreateOrder}>
            <HTMLSelect 
              value={sourceId} 
              onChange={e => setSourceId(e.target.value)} 
              fill={true}
              required
            >
              <option value="">Select source depot</option>
              {deposits.map(dep => (
                <option key={dep.Id} value={dep.Id}>{dep.Name}</option>
              ))}
            </HTMLSelect>
            
            <HTMLSelect 
              value={destId} 
              onChange={e => setDestId(e.target.value)} 
              fill={true}
              required
              style={{ marginTop: "10px" }}
            >
              <option value="">Select destination depot</option>
              {deposits.map(dep => (
                <option key={dep.Id} value={dep.Id}>{dep.Name}</option>
              ))}
            </HTMLSelect>
            
            <Button 
              intent="primary" 
              text="Create Order" 
              type="submit" 
              fill={true}
              style={{ marginTop: "10px" }}
            />
          </form>
        </div>
        
        <div className="section">
          <h2>Package Status</h2>
          {packages.length === 0 ? (
            <p>No packages available</p>
          ) : (
            packages.map(pkg => (
              <Card key={pkg.Id} elevation={Elevation.TWO} style={{marginBottom: "1em"}}>
                <h3>Package {pkg.Id}</h3>
                <p>
                  Route: {deposits.find(d => d.Id === pkg.SourceDeposit)?.Name || pkg.SourceDeposit} ➜ 
                  {deposits.find(d => d.Id === pkg.DestinationDeposit)?.Name || pkg.DestinationDeposit}
                </p>
                <p>Status: <Tag intent={stateIntent(pkg.State)}>{pkg.State}</Tag></p>
                <p>Contents: {pkg.Contents.length} articles</p>
                <ProgressBar 
                  value={stateProgress(pkg.State)} 
                  intent={stateIntent(pkg.State)}
                  stripes={pkg.State !== "AtDestination"} 
                  animate={pkg.State !== "AtDestination"} 
                />
              </Card>
            ))
          )}
        </div>
        
        <div className="section">
          <h2>Deposits</h2>
          <div className="deposits-grid">
            {deposits.map(dep => (
              <Card key={dep.Id} elevation={Elevation.TWO}>
                <h3>{dep.Name}</h3>
                <p>Packages on site: {dep.PackagesOnSite.length}</p>
                <p>Outgoing packages: {dep.OutgoingPackageIds.length}</p>
              </Card>
            ))}
          </div>
        </div>
        
        <div className="section">
          <h2>Transport Log</h2>
          <div className="log-container">
            {transportLogs.length === 0 ? (
              <p>No transport logs available</p>
            ) : (
              transportLogs.map(log => (
                <div key={log.LogId} className="log-entry">
                  <span>Package: {log.PackageId}</span>
                  <span>From: {deposits.find(d => d.Id === log.FromDeposit)?.Name || log.FromDeposit}</span>
                  <span>To: {deposits.find(d => d.Id === log.ToDeposit)?.Name || log.ToDeposit}</span>
                  <span>Time: {new Date(log.CreatedTime).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
