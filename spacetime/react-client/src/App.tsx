import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";

import {
  DbConnection,
  ErrorContext,
  EventContext,
  Article,
  Deposit,
  Package,
  TransportLog,
} from "./module_bindings";
import { Identity } from "@clockworklabs/spacetimedb-sdk";

import "./App.css";

// Custom hook for Deposits
function useDeposits(conn: DbConnection | null): Map<string, Deposit> {
  const [deposits, setDeposits] = useState<Map<string, Deposit>>(new Map());

  useEffect(() => {
    if (!conn) return;

    // Initial load
    //setDeposits(Array.from(conn.db.deposit.iter()));
    const onInsert = (_ctx: EventContext, deposit: Deposit) => {
      setDeposits(prev => new Map(
        prev.set(deposit.id.toString(),deposit) 
      ));
    };
    conn.db.deposit.onInsert(onInsert);

    const onUpdate = (
      _ctx: EventContext, 
      oldDeposit: Deposit, 
      newDeposit: Deposit
    ) => {
      setDeposits(prev => {
        prev.delete(oldDeposit.id.toString());
        return new Map(prev.set(newDeposit.id.toString(), newDeposit));
      })
    }
    conn.db.deposit.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, deposit: Deposit) => {
      setDeposits(prevMap => {
        prevMap.delete(deposit.id.toString());
        return new Map(prevMap);
      });
    }
    conn.db.deposit.onDelete(onDelete)

    return () => {
      conn.db.deposit.removeOnInsert(onInsert);
      conn.db.deposit.removeOnDelete(onDelete);
      conn.db.deposit.removeOnUpdate(onUpdate);
    };
  }, [conn]);

  return deposits;
}

// Custom hook for Packages
function usePackages(conn: DbConnection | null): Package[] {
  const [packages, setPackages] = useState<Package[]>([]);

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, _package: Package) => {
      setPackages(prev => [...prev, _package]);
    };
    conn.db.package.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, _package: Package) => {
      setPackages(prev =>
        prev.filter(
          pack =>
            pack.id !== _package.id
        )
      );
    };
    conn.db.package.onDelete(onDelete);

    return () => {
      conn.db.package.removeOnInsert(onInsert);
      conn.db.package.removeOnDelete(onDelete);
    };
  }, [conn]);

  return packages;
}

// Custom hook for Articles
function useArticles(conn: DbConnection | null): Article[] {
  const [articles, setArticles] = useState<Article[]>([]);
  useEffect(() => {
    if (!conn) return;

    const onInsert = (_ctx: EventContext, article: Article) => {
      setArticles((prev) => [...prev, article]);
    };
    conn.db.article.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, article: Article) => {
      setArticles((prev) =>
        prev.filter((art) => art.articleId !== article.articleId)
      );
    };
    conn.db.article.onDelete(onDelete);

    return () => {
      conn.db.article.removeOnInsert(onInsert);
      conn.db.article.removeOnDelete(onDelete);
    };
  }, [conn]);

  return articles;
}

// Custom hook for Transport Logs
function useTransportLogs(conn: DbConnection | null): TransportLog[] {
  const [transportLogs, setTransportLogs] = useState<TransportLog[]>([]);
  useEffect(() => {
    if (!conn) return;

    const onInsert = (_ctx: EventContext, transportLog: TransportLog) => {
      setTransportLogs((prev) => [...prev, transportLog]);
    };
    conn.db.transportLog.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, transportLog: TransportLog) => {
      setTransportLogs((prev) =>
        prev.filter((log) => log.logId !== transportLog.logId)
      );
    };
    conn.db.transportLog.onDelete(onDelete);

    return () => {
      conn.db.transportLog.removeOnInsert(onInsert);
      conn.db.transportLog.removeOnDelete(onDelete);
    };
  }, [conn]);

  return transportLogs;
}

function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  
  const [conn, setConn] = useState<DbConnection | null>(null);
  const [sourceId, setSourceId] = useState<string>("");
  const [destId, setDestId] = useState<string>("");

  // Use our custom hooks to get data
  const deposits = useDeposits(conn);
  const packages = usePackages(conn);
  const articles = useArticles(conn);
  const transportLogs = useTransportLogs(conn);

  //chat demo code

  useEffect(() => {
    const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
      let count = 0;
      for (const query of queries) {
        conn
          ?.subscriptionBuilder()
          .onApplied(() => {
            count++;
            if (count === queries.length) {
              console.log("SDK client cache initialized.");
            }
          })
          .subscribe(query);
      }
    };

    const onConnect = (
      conn: DbConnection,
      identity: Identity,
      token: string,
    ) => {
      setIdentity(identity);
      setConnected(true);
      localStorage.setItem("auth_token", token);
      console.log(
        "Connected to SpacetimeDB with identity:",
        identity.toHexString(),
      );
      conn.reducers.onCreateTravelOrder(() => {
        console.log("Created travel order.");
      });

      subscribeToQueries(conn, ["SELECT * FROM message", "SELECT * FROM user"]);
    };

    const onDisconnect = () => {
      console.log("Disconnected from SpacetimeDB");
      setConnected(false);
    };

    const onConnectError = (_ctx: ErrorContext, err: Error) => {
      console.log("Error connecting to SpacetimeDB:", err);
    };

    setConn(
      DbConnection.builder()
        .withUri("ws://localhost:3000")
        .withModuleName("quickstart-chat")
        .withToken(localStorage.getItem("auth_token") || "")
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError)
        .build(),
    );
  }, []);

  //end chat demo code

  // Helper to map state to progress fraction
  const stateProgress = (state: string) => {
    switch (state) {
      case "Preparing":
        return 0.25;
      case "Prepared":
        return 0.5;
      case "OnTheWay":
        return 0.75;
      case "AtDestination":
        return 1.0;
      default:
        return 0;
    }
  };

  // Helper to map state to color
  const stateColor = (state: string) => {
    switch (state) {
      case "Preparing":
        return "#888";
      case "Prepared":
        return "#0088ff";
      case "OnTheWay":
        return "#ff8800";
      case "AtDestination":
        return "#00cc00";
      default:
        return "#888";
    }
  };

  const handleCreateOrder = () => {
    if (!conn || !sourceId || !destId || sourceId === destId) {
      alert("Please select different source and destination deposits");
      return;
    }

    try {
      conn.reducers.createTravelOrder(parseInt(sourceId), parseInt(destId));
      setSourceId("");
      setDestId("");
    } catch (error) {
      console.error("Failed to create travel order:", error);
      alert("Failed to create travel order: " + error);
    }
  };

  const handleAdvancePackageState = (packageId: string, newState: string) => {
    if (!conn) return;

    try {
      conn.reducers.advancePackageState(packageId, newState);
    } catch (error) {
      console.error("Failed to advance package state:", error);
      alert("Failed to advance package state: " + error);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Lodi Package Tracking</h1>
        <div className="connection-status">
          Status:{" "}
          <span className={connected ? "connected" : "disconnected"}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </header>

      <main>
        <section className="create-order">
          <h2>Create New Travel Order</h2>
          <div className="form-group">
            <label>Source Deposit:</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Select source deposit</option>
              {Array.from(deposits.entries()).map(([id, dep]) => (
                <option key={id} value={id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Destination Deposit:</label>
            <select value={destId} onChange={(e) => setDestId(e.target.value)}>
              <option value="">Select destination deposit</option>
              {Array.from(deposits.entries()).map(([id, dep]) => (
                <option key={id} value={id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>

          <button onClick={handleCreateOrder}>Create Order</button>
        </section>

        <section className="packages">
          <h2>Package Status</h2>
          {packages.length === 0 ? (
            <p>No packages available</p>
          ) : (
            <div className="package-list">
              {packages.map((pkg) => {
                const sourceDeposit = deposits.get(pkg.sourceDeposit.toString());
                const destDeposit = deposits.get(pkg.destinationDeposit.toString());

                return (
                  <div key={pkg.id} className="package-card">
                    <h3>Package {pkg.id}</h3>
                    <p>
                      <strong>Route:</strong>{" "}
                      {sourceDeposit?.name || pkg.sourceDeposit} ➜
                      {destDeposit?.name || pkg.destinationDeposit}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      <span style={{ color: stateColor(pkg.state) }}>
                        {pkg.state}
                      </span>
                    </p>
                    <p>
                      <strong>Contents:</strong> {pkg.contents.length} articles
                    </p>

                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${stateProgress(pkg.state) * 100}%`,
                          backgroundColor: stateColor(pkg.state),
                        }}
                      ></div>
                    </div>

                    <div className="package-actions">
                      {pkg.state === "Preparing" && (
                        <button
                          onClick={() =>
                            handleAdvancePackageState(pkg.id, "Prepared")
                          }
                        >
                          Mark as Prepared
                        </button>
                      )}
                      {pkg.state === "Prepared" && (
                        <button
                          onClick={() =>
                            handleAdvancePackageState(pkg.id, "OnTheWay")
                          }
                        >
                          Start Transport
                        </button>
                      )}
                      {pkg.state === "OnTheWay" && (
                        <button
                          onClick={() =>
                            handleAdvancePackageState(pkg.id, "AtDestination")
                          }
                        >
                          Mark as Delivered
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="deposits">
          <h2>Deposits</h2>
          <div className="deposit-list">
            {Array.from(deposits.values()).map((dep) => (
              <div key={dep.id} className="deposit-card">
                <h3>{dep.name}</h3>
                <p>Packages on site: {dep.packagesOnSite.length}</p>
                <p>Outgoing packages: {dep.outgoingPackageIds.length}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="transport-logs">
          <h2>Transport Log</h2>
          {transportLogs.length === 0 ? (
            <p>No transport logs available</p>
          ) : (
            <div className="log-list">
              {transportLogs.map((log) => {
                const fromDeposit = deposits.get(log.fromDeposit.toString());
                const toDeposit = deposits.get(log.toDeposit.toString());

                return (
                  <div key={log.logId} className="log-entry">
                    <p>
                      <strong>Package:</strong> {log.packageId}
                    </p>
                    <p>
                      <strong>From:</strong>{" "}
                      {fromDeposit?.name || log.fromDeposit}
                    </p>
                    <p>
                      <strong>To:</strong> {toDeposit?.name || log.toDeposit}
                    </p>
                    <p>
                      <strong>Time:</strong>{" "}
                      {new Date(log.createdTime.toDate()).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
