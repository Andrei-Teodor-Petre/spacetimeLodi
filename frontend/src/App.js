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
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "./App.css";

function App() {
  // Mock data for demonstration
  const [connected, setConnected] = useState(true);
  const [deposits, setDeposits] = useState([
    { Id: 1, Name: "North Depot", Location: "North City" },
    { Id: 2, Name: "South Depot", Location: "South City" },
    { Id: 3, Name: "East Depot", Location: "East City" },
    { Id: 4, Name: "West Depot", Location: "West City" }
  ]);
  const [packages, setPackages] = useState([
    { Id: 101, SourceDeposit: 1, DestinationDeposit: 2, State: "Preparing", Contents: ["Item1", "Item2"] },
    { Id: 102, SourceDeposit: 2, DestinationDeposit: 3, State: "Prepared", Contents: ["Item3"] },
    { Id: 103, SourceDeposit: 3, DestinationDeposit: 4, State: "OnTheWay", Contents: ["Item4", "Item5", "Item6"] },
    { Id: 104, SourceDeposit: 1, DestinationDeposit: 4, State: "AtDestination", Contents: ["Item7"] }
  ]);
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  
  useEffect(() => {
    console.log("App initialized with mock data");
    // This is a simplified version without SpacetimeDB connection
  }, []);

  const handleCreateOrder = (e) => {
    e.preventDefault();
    if (!sourceId || !destId || sourceId === destId) {
      alert("Please select different source and destination deposits");
      return;
    }
    
    // Create a mock package
    const newPackage = {
      Id: Math.floor(Math.random() * 1000) + 200,
      SourceDeposit: parseInt(sourceId),
      DestinationDeposit: parseInt(destId),
      State: "Preparing",
      Contents: ["New Item"]
    };
    
    setPackages(prev => [...prev, newPackage]);
    setSourceId("");
    setDestId("");
    alert("New order created! (Mock implementation)");
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
          <h2>Transport Logs</h2>
          <p>No transport logs available in demo mode</p>
        </div>
      </div>
    </div>
  );
}

export default App;
