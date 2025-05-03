// See https://aka.ms/new-console-template for more information
using SpacetimeDB;
using SpacetimeDB.Types;
using System.Collections.Concurrent;

Log.Info("Hello, World!");

// our local client SpacetimeDB identity
Identity? local_identity = null;

// declare a thread safe queue to store commands
var input_queue = new ConcurrentQueue<(string Command, string Args)>();

void Main()
{
    // Initialize the `AuthToken` module
    AuthToken.Init(".spacetime_csharp_quickstart");
    // Builds and connects to the database
    DbConnection? conn = null;
    conn = ConnectToDB();
    // Registers to run in response to database events.
    RegisterCallbacks(conn);
    // Declare a threadsafe cancel token to cancel the process loop
    var cancellationTokenSource = new CancellationTokenSource();
    // Spawn a thread to call process updates and process commands
    var thread = new Thread(() => ProcessThread(conn, cancellationTokenSource.Token));
    thread.Start();
    // Handles CLI input
    InputLoop();
    // This signals the ProcessThread to stop
    cancellationTokenSource.Cancel();
    thread.Join();
}



#region ConnectToDB
/// The URI of the SpacetimeDB instance hosting our chat database and module.
const string HOST = "http://localhost:3000";
/// The database name we chose when we published our module.
const string DBNAME = "lodi";
/// Load credentials from a file and connect to the database.
DbConnection ConnectToDB()
{
    DbConnection? conn = null;
    conn = DbConnection.Builder()
        .WithUri(HOST)
        .WithModuleName(DBNAME)
        .WithToken(AuthToken.Token)
        .OnConnect(OnConnected)
        .OnConnectError(OnConnectError)
        .OnDisconnect(OnDisconnected)
        .Build();
    return conn;
}

/// Our `OnConnect` callback: save our credentials to a file.
void OnConnected(DbConnection conn, Identity identity, string authToken)
{
    local_identity = identity;
    AuthToken.SaveToken(authToken);

    conn.SubscriptionBuilder()
        .OnApplied(OnSubscriptionApplied)
        .SubscribeToAllTables();
}

/// Our `OnConnectError` callback: print the error, then exit the process.
void OnConnectError(Exception e)
{
    Console.Write($"Error while connecting: {e}");
}

/// Our `OnDisconnect` callback: print a note, then exit the process.
void OnDisconnected(DbConnection conn, Exception? e)
{
    if (e != null)
    {
        Console.Write($"Disconnected abnormally: {e}");
    }
    else
    {
        Console.Write($"Disconnected normally.");
    }
}

/// Register all the callbacks our app will use to respond to database events.
void RegisterCallbacks(DbConnection conn)
{
    //update this with my logic
    conn.Db.Deposit.OnInsert += Deposit_OnInsert;
    conn.Db.Deposit.OnUpdate += Deposit_OnUpdate;

    conn.Db.Package.OnInsert += Package_OnInsert;
    conn.Db.Package.OnUpdate += Package_OnUpdate;
    
    conn.Db.TransportLog.OnInsert += TransportLog_OnInsert;
    conn.Db.TransportLog.OnUpdate += TransportLog_OnUpdate;
    
    conn.Db.Article.OnInsert += Article_OnInsert;
    conn.Db.Article.OnUpdate += Article_OnUpdate;
}
#endregion


#region Callbacks

void Deposit_OnInsert(EventContext ctx, Deposit deposit)
{
    Log.Info($"Deposit {deposit.Id} created at {deposit.Name}");
}
void Deposit_OnUpdate(EventContext ctx, Deposit oldValue, Deposit newValue)
{
    Log.Info($"Deposit {oldValue.Name} updated at {newValue.Name}");
}

void Package_OnInsert(EventContext ctx, Package pkg)
{
    Log.Info($"Package {pkg.Id} created at {pkg.SourceDeposit}");
}
void Package_OnUpdate(EventContext ctx, Package oldValue, Package newValue)
{
    Log.Info($"Package {oldValue.Contents} updated at {newValue.Contents}");
}

void TransportLog_OnInsert(EventContext ctx, TransportLog log)
{
    Log.Info($"TransportLog {log.LogId} created at {log.FromDeposit}");
}
void TransportLog_OnUpdate(EventContext ctx, TransportLog oldValue, TransportLog newValue)
{
    Log.Info($"TransportLog {oldValue.LogId} updated at {newValue.ToDeposit}");
}

void Article_OnInsert(EventContext ctx, Article art)
{
    Log.Info($"Article {art.ArticleId} created at {art.CurrentDeposit}");
}
void Article_OnUpdate(EventContext ctx, Article oldValue, Article newValue)
{
    Log.Info($"Article {oldValue.ArticleId} updated at {newValue.ArticleId}");
}

#endregion


/// Our `OnSubscriptionApplied` callback:
/// log the state of all deposits in the system.

void OnSubscriptionApplied(SubscriptionEventContext ctx)
{
    Console.WriteLine("Subscription applied!");
    // Example: print all deposits
    foreach (var deposit in ctx.Db.Deposit.Iter())
    {
        Console.WriteLine($"{deposit.Name} (Id: {deposit.Id})");
    }
}


/// Our separate thread from main, where we can call process updates and process commands without blocking the main thread. 
void ProcessThread(DbConnection conn, CancellationToken ct)
{
    try
    {
        // loop until cancellation token
        while (!ct.IsCancellationRequested)
        {
            // Process any database updates
            conn.FrameTick();

            // Process any user commands from the input queue
            ProcessCommands(conn.Reducers, conn);

            // Small delay to prevent high CPU usage
            Thread.Sleep(100);
        }
    }
    finally
    {
        // Ensure we disconnect from the database when the thread ends
        conn.Disconnect();
    }
}

/// Read each line of standard input and process commands for the Lodi package tracking system.
void InputLoop()
{
    Console.WriteLine("Lodi Package Tracking System");
    Console.WriteLine("Available commands:");
    Console.WriteLine("  /list-deposits - List all available deposits");
    Console.WriteLine("  /create-travel <sourceDepotId> <destDepotId> - Create a travel order");
    Console.WriteLine("  /advance-package <packageId> <newState> - Advance a package's state");
    Console.WriteLine("  /update-article <articleId> <newStatus> - Update an article's status");
    Console.WriteLine("  /help - Show this help message");
    Console.WriteLine("  /exit - Exit the application");
    
    while (true)
    {
        Console.Write("> ");
        var input = Console.ReadLine();
        if (input == null || input.Equals("/exit", StringComparison.OrdinalIgnoreCase))
        {
            break;
        }

        if (input.Equals("/help", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine("Available commands:");
            Console.WriteLine("  /list-deposits - List all available deposits");
            Console.WriteLine("  /create-travel <sourceDepotId> <destDepotId> - Create a travel order");
            Console.WriteLine("  /advance-package <packageId> <newState> - Advance a package's state");
            Console.WriteLine("  /update-article <articleId> <newStatus> - Update an article's status");
            Console.WriteLine("  /help - Show this help message");
            Console.WriteLine("  /exit - Exit the application");
            continue;
        }
        else if (input.Equals("/list-deposits", StringComparison.OrdinalIgnoreCase))
        {
            input_queue.Enqueue(("list-deposits", string.Empty));
        }
        else if (input.StartsWith("/create-travel ", StringComparison.OrdinalIgnoreCase))
        {
            input_queue.Enqueue(("create-travel", input[15..]));
        }
        else if (input.StartsWith("/advance-package ", StringComparison.OrdinalIgnoreCase))
        {
            input_queue.Enqueue(("advance-package", input[17..]));
        }
        else if (input.StartsWith("/update-article ", StringComparison.OrdinalIgnoreCase))
        {
            input_queue.Enqueue(("update-article", input[16..]));
        }
        else
        {
            Console.WriteLine("Unknown command. Type /help for available commands.");
        }
    }
}

// Process commands from the input queue using the provided reducers and database connection
void ProcessCommands(RemoteReducers reducers, DbConnection conn)
{
    // Process input queue commands
    while (input_queue.TryDequeue(out var command))
    {
        try
        {
            switch (command.Command)
            {
                case "list-deposits":
                    Console.WriteLine("Available Deposits:");
                    // Access deposits through the DbConnection object
                    foreach (var deposit in conn.Db.Deposit.Iter())
                    {
                        Console.WriteLine($"ID: {deposit.Id} - {deposit.Name}");
                    }
                    break;
                    
                case "create-travel":
                    var travelArgs = command.Args.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (travelArgs.Length == 2 && uint.TryParse(travelArgs[0], out uint sourceId) && uint.TryParse(travelArgs[1], out uint destId))
                    {
                        reducers.CreateTravelOrder(sourceId, destId);
                        Console.WriteLine($"Created travel order from depot {sourceId} to depot {destId}");
                    }
                    else
                    {
                        Console.WriteLine("Invalid arguments. Usage: /create-travel <sourceDepotId> <destDepotId>");
                    }
                    break;
                    
                case "advance-package":
                    var packageArgs = command.Args.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                    if (packageArgs.Length == 2)
                    {
                        string packageId = packageArgs[0];
                        string newState = packageArgs[1];
                        reducers.AdvancePackageState(packageId, newState);
                        Console.WriteLine($"Advanced package {packageId} to state '{newState}'");
                    }
                    else
                    {
                        Console.WriteLine("Invalid arguments. Usage: /advance-package <packageId> <newState>");
                    }
                    break;
                    
                case "update-article":
                    var articleArgs = command.Args.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                    if (articleArgs.Length == 2)
                    {
                        string articleId = articleArgs[0];
                        string newStatus = articleArgs[1];
                        reducers.UpdateArticleStatus(articleId, newStatus);
                        Console.WriteLine($"Updated article {articleId} status to '{newStatus}'");
                    }
                    else
                    {
                        Console.WriteLine("Invalid arguments. Usage: /update-article <articleId> <newStatus>");
                    }
                    break;
                    
                default:
                    Console.WriteLine($"Unknown command: {command.Command}");
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error processing command: {ex.Message}");
        }
    }
}

Main();