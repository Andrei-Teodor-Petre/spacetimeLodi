# SpacetimeDB Demo: Real-Time Deposits & Packages Application

## Architecture Overview

### Backend (SpacetimeDB)
Acts as both the database and server-side logic engine. We define a module in C# that contains tables for Deposits, Packages, Articles, and a TransportLog. SpacetimeDB's real-time subscription feature automatically syncs relevant data to connected clients, so any state changes in these tables are pushed to the frontend instantly.

### Local C# Service (Worker)
A supporting .NET service (optional) simulates time-based events. It watches for new package travel orders and updates package status over time (e.g., moving from Preparing to On The Way). This service uses SpacetimeDB's client SDK to subscribe to data changes and call reducers (server functions) to update state.

### Frontend (React + BlueprintJS)
A single-page application provides a UI for users to create orders and monitor package delivery status in real-time. It connects to SpacetimeDB via WebSockets and subscribes to the Deposits and Packages tables. The UI is built with BlueprintJS components for a clean, interactive experience (dropdowns for selecting deposits, buttons to dispatch orders, and dynamic displays of package status).

## SpacetimeDB Schema and Data Model

We design four main tables in the SpacetimeDB module (with C# definitions):

### Deposit
Represents a depot location. Each deposit keeps track of which packages are currently on-site and which packages are scheduled to be sent out. We model this with two list fields: PackagesOnSite and OutgoingPackageIds (both lists of package IDs as strings).

### Package
Represents a shipment container. Fields include a unique Id (could be a string code), a MaxLoad capacity, a list of Contents (IDs of articles inside, as strings), a State (one of Preparing, Prepared, OnTheWay, AtDestination), a SourceDeposit and a DestinationDeposit ID.

### Article
Represents an individual item or article that can be shipped. Each article has an ArticleId (string), a CurrentDeposit (where it resides currently), and a Status (e.g. in_stock, in_transit, processing, delivered). Articles start at a deposit in in_stock status and get updated as they move through the system.

### TransportLog
A log of package movements for audit and analytics. Each record logs a PackageId, the FromDeposit (source), the ToDeposit (destination), and a timestamp of when the transport was initiated. (For simplicity, we create one log entry per package shipment when it's created.)

Below is a snippet of the C# module schema using SpacetimeDB attributes to define these tables. By marking tables as Public, we allow the frontend clients to subscribe and read their data:

```csharp
// Using SpacetimeDB's C# module definitions
[SpacetimeDB.Table(Name = "deposit", Public = true)]
public partial class Deposit {
    [SpacetimeDB.PrimaryKey] 
    public uint Id;                 // Unique ID for the deposit (auto-increment)
    public string Name;             // Human-readable name/location
    public List<string> PackagesOnSite;      // IDs of packages currently at this deposit
    public List<string> OutgoingPackageIds;  // IDs of packages scheduled to be sent from here
}

[SpacetimeDB.Table(Name = "package", Public = true)]
public partial class Package {
    [SpacetimeDB.PrimaryKey] 
    public string Id;            // Unique package ID (could be a generated code)
    public uint MaxLoad;
    public List<string> Contents;   // Article IDs inside this package
    public string State;            // "Preparing", "Prepared", "OnTheWay", or "AtDestination"
    public uint SourceDeposit;
    public uint DestinationDeposit;
}

[SpacetimeDB.Table(Name = "article", Public = true)]
public partial class Article {
    [SpacetimeDB.PrimaryKey] 
    public string ArticleId;     // Unique article identifier (string)
    public uint CurrentDeposit;  // Deposit where the article currently is
    public string Status;        // "in_stock", "in_transit", "processing", "delivered"
}

[SpacetimeDB.Table(Name = "transport_log", Public = true)]
public partial class TransportLog {
    [SpacetimeDB.PrimaryKey] 
    public uint LogId; 
    public string PackageId;
    public uint FromDeposit;
    public uint ToDeposit;
    public Timestamp CreatedTime;
}
```

## Mock Data Initialization

On startup (or module deployment), we populate the database with a few deposits and packages to simulate existing data. For example, we might insert 2–3 Deposit rows and some Article records at each deposit. Each deposit can be initialized with a random inventory of up to 55 articles (assigning each Article a random ID like "ART-<GUID>" and Status = "in_stock" at that deposit). We also insert a couple of Package records to start. For instance, perhaps Depot A has a package that is already Prepared to go to Depot B.

Here's pseudo-code that could run at initialization to create some data:

```csharp
// Pseudo-code for initial data setup (could be run via a special init reducer)
var depotA = ctx.Db.deposit.Insert(new Deposit {
    Id = 0, Name = "Depot A", 
    PackagesOnSite = new List<string>(), OutgoingPackageIds = new List<string>()
});
var depotB = ctx.Db.deposit.Insert(new Deposit {
    Id = 0, Name = "Depot B", 
    PackagesOnSite = new List<string>(), OutgoingPackageIds = new List<string>()
});

// Create random articles at each depot
for (int i = 0; i < 30; i++) {
    string artId = $"ART-{Guid.NewGuid()}";
    ctx.Db.article.Insert(new Article { ArticleId = artId, CurrentDeposit = depotA.Id, Status = "in_stock" });
}
for (int j = 0; j < 25; j++) {
    string artId = $"ART-{Guid.NewGuid()}";
    ctx.Db.article.Insert(new Article { ArticleId = artId, CurrentDeposit = depotB.Id, Status = "in_stock" });
}

// Create an initial package at Depot A destined for Depot B
var initialPkg = new Package {
    Id = "PKG1", MaxLoad = 50, 
    Contents = new List<string> { /* e.g., pick some ArticleIds from Depot A */ }, 
    State = "Prepared", 
    SourceDeposit = depotA.Id, DestinationDeposit = depotB.Id
};
initialPkg = ctx.Db.package.Insert(initialPkg);

// Update Depot A to reflect this package on site and outgoing
depotA.PackagesOnSite.Add(initialPkg.Id);
depotA.OutgoingPackageIds.Add(initialPkg.Id);
ctx.Db.deposit.Id.Update(depotA);

ctx.Db.transport_log.Insert(new TransportLog {
    LogId = 0, PackageId = initialPkg.Id, 
    FromDeposit = depotA.Id, ToDeposit = depotB.Id, CreatedTime = ctx.Time 
});
```

After initialization, the database might have, say, Depot A with one package (PKG1) ready to send to Depot B, and both depots have a stock of articles. This provides a starting point for the demo.

## Server-Side Logic with C# Reducers

With the schema in place, we implement reducers – server-side functions that clients can invoke to modify data within an ACID transaction. The primary operations we need are: creating a new travel order (which involves creating a package and updating deposits/logs) and updating the state of a package as it moves.

### 1. Create Travel Order Reducer

This function is called when a user submits a new shipment request from the frontend. It will create a new Package and update the relevant Deposit and TransportLog entries. For example, `CreateTravelOrder(sourceId, destId)` does the following in one transaction:

1. Verify the source and destination deposit exist (and potentially that they are different).
2. Generate a new unique Package ID (e.g., using an auto-increment or GUID with a "PKG" prefix).
3. Select a random subset of articles from the source depot's inventory to put into the package (simulate picking items to deliver). Mark those articles as in_transit since they are leaving the depot.
4. Insert the new Package with State = "Preparing", the chosen contents, and the specified Source and Destination.
5. Update the source Deposit.PackagesOnSite and OutgoingPackageIds lists to include this new package (since it's now at the source and waiting to be sent).
6. Create a new TransportLog entry recording the package's ID, source, destination, and current timestamp.

Below is a simplified code snippet for the CreateTravelOrder reducer:

```csharp
[SpacetimeDB.Reducer]
public static void CreateTravelOrder(ReducerContext ctx, uint sourceDepotId, uint destDepotId) {
    // Lookup source and destination deposits
    var source = ctx.Db.deposit.Id.Find(sourceDepotId).unwrap();
    var dest = ctx.Db.deposit.Id.Find(destDepotId).unwrap();
    if (sourceDepotId == destDepotId) throw new Exception("Source and destination must differ");

    // Generate a new Package ID (e.g., increment a counter or GUID)
    string newPkgId = $"PKG-{ctx.Time.Ticks}";  // simple unique ID using timestamp
    
    // Select some articles from source to include (for demo, just take up to 5)
    var contents = new List<string>();
    foreach (var art in ctx.Db.article.Iter()) {
        if (art.CurrentDeposit == sourceDepotId && art.Status == "in_stock" && contents.Count < 5) {
            art.Status = "in_transit";
            ctx.Db.article.ArticleId.Update(art);    // mark article as leaving
            contents.Add(art.ArticleId);
        }
    }
    
    // Create the new package in 'Preparing' state
    var pkg = new Package { 
        Id = newPkgId, MaxLoad = 100, Contents = contents, 
        State = "Preparing", SourceDeposit = sourceDepotId, DestinationDeposit = destDepotId 
    };
    ctx.Db.package.Insert(pkg);
    
    // Update source deposit's lists
    source.PackagesOnSite.Add(newPkgId);
    source.OutgoingPackageIds.Add(newPkgId);
    ctx.Db.deposit.Id.Update(source);
    
    // Log this transport order
    ctx.Db.transport_log.Insert(new TransportLog {
        LogId = 0, PackageId = newPkgId, 
        FromDeposit = sourceDepotId, ToDeposit = destDepotId, 
        CreatedTime = ctx.Time 
    });
}
```

### 2. Update Package State Reducer

As packages move, we need to update their state and related data. We define a reducer (e.g., `AdvancePackageState(packageId, newState)`) that will be called by our simulation service to bump a package to its next stage. This function will:

1. Find the package by ID and verify the transition is valid (e.g., you can only go Preparing -> Prepared -> OnTheWay -> AtDestination in order).
2. Update the Package.State field.
3. If moving to "OnTheWay": remove the package from the source deposit's lists since it's departing.
4. If moving to "AtDestination": add the package to the destination deposit's PackagesOnSite list, and mark all articles in that package as processing at the destination.

Example implementation for AdvancePackageState:

```csharp
[SpacetimeDB.Reducer]
public static void AdvancePackageState(ReducerContext ctx, string packageId, string newState) {
    var pkg = ctx.Db.package.Id.Find(packageId).unwrap();
    string current = pkg.State;
    
    // Validate allowed transitions (simple check)
    var validNext = new Dictionary<string, string> {
        {"Preparing", "Prepared"}, {"Prepared", "OnTheWay"}, {"OnTheWay", "AtDestination"}
    };
    if (!validNext.ContainsKey(current) || validNext[current] != newState) {
        throw new Exception($"Invalid state transition: {current} -> {newState}");
    }
    
    // Perform state update
    pkg.State = newState;
    ctx.Db.package.Id.Update(pkg);

    // Handle side-effects of specific states
    if (newState == "OnTheWay") {
        // Package leaving source deposit
        var source = ctx.Db.deposit.Id.Find(pkg.SourceDeposit).unwrap();
        source.PackagesOnSite.Remove(packageId);
        source.OutgoingPackageIds.Remove(packageId);
        ctx.Db.deposit.Id.Update(source);
    } 
    else if (newState == "AtDestination") {
        // Package arrived at destination
        var dest = ctx.Db.deposit.Id.Find(pkg.DestinationDeposit).unwrap();
        dest.PackagesOnSite.Add(packageId);
        ctx.Db.deposit.Id.Update(dest);
        
        // Update contained articles: now processing at destination
        foreach (var artId in pkg.Contents) {
            var article = ctx.Db.article.ArticleId.Find(artId).unwrap();
            article.CurrentDeposit = pkg.DestinationDeposit;
            article.Status = "processing";
            ctx.Db.article.ArticleId.Update(article);
        }
    }
}
```

## Simulating Package Transit (Background Service)

To simulate the package going through its journey over time (with 2–5 second intervals per state), we use a small C# worker service. This service runs outside the database but connects as a privileged client. Its job is to listen for new travel orders and invoke the AdvancePackageState reducer at appropriate intervals.

How the worker operates:
1. Connect to the SpacetimeDB instance (e.g., via WebSocket) and authenticate if needed.
2. Register a subscription for packages, for example `client.Subscribe("SELECT * FROM package")`, so it receives all package updates.
3. Set up event handlers: on a new package insert or on a package update, check its state.
4. If a package is in "Preparing" (meaning a new order was just created), start a task to advance it through the states:
   - Wait ~2 seconds, then call `AdvancePackageState(packageId, "Prepared")`.
   - Wait another ~2 seconds, then call `AdvancePackageState(packageId, "OnTheWay")`.
   - Wait ~3 seconds, then call `AdvancePackageState(packageId, "AtDestination")`.

Here's a simplified sketch of the worker logic in C#:

```csharp
// Connect to SpacetimeDB as a client
var conn = await SpacetimeDBClient.ConnectAsync(new Uri("ws://localhost:3000/db")); 
await conn.Subscribe("SELECT * FROM package");  // subscribe to all packages

// Handle new packages
conn.Db.package.OnInsert += (ctx, newPkg) => {
    if (newPkg.State == "Preparing") {
        // Launch a background task for state progression
        Task.Run(async () => {
            await Task.Delay(2000);
            await conn.Reducers.AdvancePackageState(newPkg.Id, "Prepared");
            await Task.Delay(2000);
            await conn.Reducers.AdvancePackageState(newPkg.Id, "OnTheWay");
            await Task.Delay(3000);
            await conn.Reducers.AdvancePackageState(newPkg.Id, "AtDestination");
            
            // After arrival, simulate article delivery
            await Task.Delay(2000);
            foreach (var artId in newPkg.Contents) {
                await conn.Reducers.UpdateArticleStatus(artId, "delivered");
            }
        });
    }
};
```

**Old Data Retention**: We do not delete delivered packages or articles. Packages that have completed their journey remain in the database with state "AtDestination", and their records can be used for analytics or history.

## Frontend UI (BlueprintJS with React)

The frontend is a React application styled with BlueprintJS components for a clean, professional look. It connects to the SpacetimeDB backend to both send user actions and receive live updates:

### Connection & Subscription
On app startup, the frontend establishes a WebSocket connection to the SpacetimeDB server (using the SpacetimeDB TypeScript client library). After connecting, it subscribes to the relevant tables, specifically Deposit, Package, and perhaps Article and TransportLog if needed.

### Deposit Selection Form
The app provides a form to create a new travel order. Using BlueprintJS's form components, we present two dropdowns (source and destination) populated with the list of deposits from the live data, and a submit button.

```jsx
import { HTMLSelect, Button } from "@blueprintjs/core";

// Assuming `deposits` is an array of deposit objects from the SpacetimeDB client cache
function NewOrderForm({ deposits, onCreate }) {
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  
  return (
    <form onSubmit={e => { e.preventDefault(); onCreate(sourceId, destId); }}>
      <HTMLSelect value={sourceId} onChange={e => setSourceId(e.target.value)} required>
        <option value="">Select source depot</option>
        {deposits.map(dep => (
          <option key={dep.Id} value={dep.Id}>{dep.Name}</option>
        ))}
      </HTMLSelect>{" "}
      <HTMLSelect value={destId} onChange={e => setDestId(e.target.value)} required>
        <option value="">Select destination depot</option>
        {deposits.map(dep => (
          <option key={dep.Id} value={dep.Id}>{dep.Name}</option>
        ))}
      </HTMLSelect>{" "}
      <Button intent="primary" text="Create Order" type="submit" />
    </form>
  );
}
```

### Real-Time Status View
Once orders are in progress, the UI needs to reflect their status changes immediately. We can subscribe to the Package table and maintain a list of package objects in React state.

```jsx
import { Card, Elevation, Tag, ProgressBar } from "@blueprintjs/core";

function PackageStatusList({ packages }) {
  // Helper to map state to progress fraction and color
  const stateProgress = (state) => {
    switch(state) {
      case "Preparing": return 0.25;
      case "Prepared":  return 0.5;
      case "OnTheWay":  return 0.75;
      case "AtDestination": return 1.0;
      default: return 0;
    }
  };
  
  const stateIntent = (state) => {
    switch(state) {
      case "OnTheWay": return "warning";    // e.g., yellow tag for in-transit
      case "AtDestination": return "success"; // green tag for delivered
      default: return "none";
    }
  };

  return (
    <div>
      {packages.map(pkg => (
        <Card key={pkg.Id} elevation={Elevation.TWO} style={{marginBottom: "1em"}}>
          <h5>Package {pkg.Id}</h5>
          <p>Route: Depot {pkg.SourceDeposit} ➜ Depot {pkg.DestinationDeposit}</p>
          <p>Status: <Tag intent={stateIntent(pkg.State)}>{pkg.State}</Tag></p>
          <ProgressBar value={stateProgress(pkg.State)} stripes={false} animate={false} />
        </Card>
      ))}
    </div>
  );
}
```

### Live Deposit Updates
We can also show deposit information updating in real-time. For example, each deposit could display how many packages are currently there or a list of outgoing packages.

### Transport Log View
As a supplement, the app could have an administrative view showing the TransportLog entries (package ID, from, to, timestamp).

## Conclusion

In this demo architecture, SpacetimeDB serves as a unified platform for both data storage and server-side logic, enabling real-time updates and simplifying the overall design. We used C# on the backend to define the schema and critical logic (leveraging SpacetimeDB's module system to embed game/server logic in the database), and a small C# worker to simulate time-based state transitions.

On the frontend, BlueprintJS components in a React app provide an interactive interface for users to create shipments and watch their status change in real time. The key benefits of this setup are the real-time synchronization (powered by SpacetimeDB's subscription queries) and an easy-to-follow structure: deposits and packages are clearly modeled, state changes are centrally managed, and the UI remains in sync without complex manual update code.

With the above setup guide and code snippets, one can implement a basic end-to-end system where creating a travel order triggers a live workflow: the package state progresses from preparation to delivery within seconds, and the entire journey is visible to the user as it happens. This demonstrates SpacetimeDB's strength in real-time collaborative applications (even beyond games) and how it can simplify building a supply-chain-esque tracking demo.