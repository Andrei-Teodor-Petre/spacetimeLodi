using System;
using System.Threading.Tasks;
using SpacetimeDB.Client;

namespace LodiWorker
{
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.WriteLine("Starting Lodi Worker Service...");
            
            // Connect to SpacetimeDB as a client
            var conn = await SpacetimeDBClient.ConnectAsync(new Uri("ws://localhost:3000/db")); 
            await conn.Subscribe("SELECT * FROM package");  // subscribe to all packages

            Console.WriteLine("Connected to SpacetimeDB and subscribed to packages");

            // Handle new packages
            conn.Db.package.OnInsert += (ctx, newPkg) => {
                Console.WriteLine($"New package detected: {newPkg.Id} in state {newPkg.State}");
                
                if (newPkg.State == "Preparing") {
                    // Launch a background task for state progression
                    Task.Run(async () => {
                        Console.WriteLine($"Starting state progression for package {newPkg.Id}");
                        
                        await Task.Delay(2000);
                        Console.WriteLine($"Advancing package {newPkg.Id} to Prepared");
                        await conn.Reducers.AdvancePackageState(newPkg.Id, "Prepared");
                        
                        await Task.Delay(2000);
                        Console.WriteLine($"Advancing package {newPkg.Id} to OnTheWay");
                        await conn.Reducers.AdvancePackageState(newPkg.Id, "OnTheWay");
                        
                        await Task.Delay(3000);
                        Console.WriteLine($"Advancing package {newPkg.Id} to AtDestination");
                        await conn.Reducers.AdvancePackageState(newPkg.Id, "AtDestination");
                        
                        // After arrival, simulate article delivery
                        await Task.Delay(2000);
                        Console.WriteLine($"Updating articles in package {newPkg.Id} to delivered");
                        foreach (var artId in newPkg.Contents) {
                            await conn.Reducers.UpdateArticleStatus(artId, "delivered");
                        }
                    });
                }
            };

            // Keep the application running
            Console.WriteLine("Worker is running. Press any key to exit.");
            Console.ReadKey();
        }
    }
}