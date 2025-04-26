using System;
using System.Collections.Generic;
using SpacetimeDB;

namespace LodiModule
{
    [SpacetimeDB.Table(Name = "deposit", Public = true)]
    public partial class Deposit 
    {
        [SpacetimeDB.PrimaryKey] 
        public uint Id;                 // Unique ID for the deposit (auto-increment)
        public string Name;             // Human-readable name/location
        public List<string> PackagesOnSite;      // IDs of packages currently at this deposit
        public List<string> OutgoingPackageIds;  // IDs of packages scheduled to be sent from here
    }

    [SpacetimeDB.Table(Name = "package", Public = true)]
    public partial class Package 
    {
        [SpacetimeDB.PrimaryKey] 
        public string Id;            // Unique package ID (could be a generated code)
        public uint MaxLoad;
        public List<string> Contents;   // Article IDs inside this package
        public string State;            // "Preparing", "Prepared", "OnTheWay", or "AtDestination"
        public uint SourceDeposit;
        public uint DestinationDeposit;
    }

    [SpacetimeDB.Table(Name = "article", Public = true)]
    public partial class Article 
    {
        [SpacetimeDB.PrimaryKey] 
        public string ArticleId;     // Unique article identifier (string)
        public uint CurrentDeposit;  // Deposit where the article currently is
        public string Status;        // "in_stock", "in_transit", "processing", "delivered"
    }

    [SpacetimeDB.Table(Name = "transport_log", Public = true)]
    public partial class TransportLog 
    {
        [SpacetimeDB.PrimaryKey] 
        public uint LogId; 
        public string PackageId;
        public uint FromDeposit;
        public uint ToDeposit;
        public Timestamp CreatedTime;
    }

    public class ModuleInitializer
    {
        [SpacetimeDB.Reducer]
        public static void Initialize(ReducerContext ctx)
        {
            // Create initial deposits
            var depotA = ctx.Db.deposit.Insert(new Deposit {
                Id = 0, // Auto-assigned
                Name = "Depot A", 
                PackagesOnSite = new List<string>(), 
                OutgoingPackageIds = new List<string>()
            });
            
            var depotB = ctx.Db.deposit.Insert(new Deposit {
                Id = 0, // Auto-assigned
                Name = "Depot B", 
                PackagesOnSite = new List<string>(), 
                OutgoingPackageIds = new List<string>()
            });

            // Create random articles at each depot
            for (int i = 0; i < 30; i++) {
                string artId = $"ART-{Guid.NewGuid()}";
                ctx.Db.article.Insert(new Article { 
                    ArticleId = artId, 
                    CurrentDeposit = depotA.Id, 
                    Status = "in_stock" 
                });
            }
            
            for (int j = 0; j < 25; j++) {
                string artId = $"ART-{Guid.NewGuid()}";
                ctx.Db.article.Insert(new Article { 
                    ArticleId = artId, 
                    CurrentDeposit = depotB.Id, 
                    Status = "in_stock" 
                });
            }

            // Create an initial package at Depot A destined for Depot B
            var articlesForPackage = new List<string>();
            foreach (var art in ctx.Db.article.Iter()) {
                if (art.CurrentDeposit == depotA.Id && articlesForPackage.Count < 3) {
                    articlesForPackage.Add(art.ArticleId);
                    art.Status = "in_transit";
                    ctx.Db.article.ArticleId.Update(art);
                }
            }

            var initialPkg = new Package {
                Id = "PKG1", 
                MaxLoad = 50, 
                Contents = articlesForPackage, 
                State = "Prepared", 
                SourceDeposit = depotA.Id, 
                DestinationDeposit = depotB.Id
            };
            initialPkg = ctx.Db.package.Insert(initialPkg);

            // Update Depot A to reflect this package on site and outgoing
            depotA.PackagesOnSite.Add(initialPkg.Id);
            depotA.OutgoingPackageIds.Add(initialPkg.Id);
            ctx.Db.deposit.Id.Update(depotA);

            ctx.Db.transport_log.Insert(new TransportLog {
                LogId = 0, // Auto-assigned
                PackageId = initialPkg.Id, 
                FromDeposit = depotA.Id, 
                ToDeposit = depotB.Id, 
                CreatedTime = ctx.Time 
            });
        }

        [SpacetimeDB.Reducer]
        public static void CreateTravelOrder(ReducerContext ctx, uint sourceDepotId, uint destDepotId) {
            // Lookup source and destination deposits
            var source = ctx.Db.deposit.Id.Find(sourceDepotId).unwrap();
            var dest = ctx.Db.deposit.Id.Find(destDepotId).unwrap();
            if (sourceDepotId == destDepotId) throw new Exception("Source and destination must differ");

            // Generate a new Package ID
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
                Id = newPkgId, 
                MaxLoad = 100, 
                Contents = contents, 
                State = "Preparing", 
                SourceDeposit = sourceDepotId, 
                DestinationDeposit = destDepotId 
            };
            ctx.Db.package.Insert(pkg);
            
            // Update source deposit's lists
            source.PackagesOnSite.Add(newPkgId);
            source.OutgoingPackageIds.Add(newPkgId);
            ctx.Db.deposit.Id.Update(source);
            
            // Log this transport order
            ctx.Db.transport_log.Insert(new TransportLog {
                LogId = 0, // Auto-assigned
                PackageId = newPkgId, 
                FromDeposit = sourceDepotId, 
                ToDeposit = destDepotId, 
                CreatedTime = ctx.Time 
            });
        }

        [SpacetimeDB.Reducer]
        public static void AdvancePackageState(ReducerContext ctx, string packageId, string newState) {
            var pkg = ctx.Db.package.Id.Find(packageId).unwrap();
            string current = pkg.State;
            
            // Validate allowed transitions
            var validNext = new Dictionary<string, string> {
                {"Preparing", "Prepared"}, 
                {"Prepared", "OnTheWay"}, 
                {"OnTheWay", "AtDestination"}
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

        [SpacetimeDB.Reducer]
        public static void UpdateArticleStatus(ReducerContext ctx, string articleId, string newStatus) {
            var article = ctx.Db.article.ArticleId.Find(articleId).unwrap();
            article.Status = newStatus;
            ctx.Db.article.ArticleId.Update(article);
        }
    }
}