using System.Text.Json;
using TransactionSimulator;

class Program
{
    static async Task Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        
        // Load configuration
        var config = LoadConfiguration();
        if (config == null)
        {
            Console.WriteLine("Error: Could not load configuration from appsettings.json");
            Console.WriteLine("Please ensure appsettings.json exists with ApiBaseUrl and Credentials.");
            return;
        }

        var apiClient = new ApiClient(config.ApiBaseUrl);

        try
        {
            Console.WriteLine("=== Transaction Simulator ===");
            Console.WriteLine();
            Console.WriteLine($"Connecting to API: {config.ApiBaseUrl}");
            Console.WriteLine($"Email: {config.Credentials.Email}");
            Console.WriteLine();

            // Authenticate
            Console.WriteLine("Authenticating...");
            var loginResponse = await apiClient.LoginAsync(config.Credentials.Email, config.Credentials.Password);
            Console.WriteLine($"✓ Successfully authenticated as {loginResponse.User.FullName} ({loginResponse.User.Role})");
            Console.WriteLine();

            // Main menu loop
            while (true)
            {
                ShowMenu();
                var choice = Console.ReadLine()?.Trim();

                switch (choice)
                {
                    case "1":
                        await CreateSingleTransaction(apiClient);
                        break;
                    case "2":
                        await CreateMultipleTransactions(apiClient);
                        break;
                    case "3":
                        await CreateRandomTransactions(apiClient);
                        break;
                    case "4":
                        Console.WriteLine("Exiting...");
                        return;
                    default:
                        Console.WriteLine("Invalid choice. Please try again.");
                        break;
                }

                Console.WriteLine();
                Console.WriteLine("Press any key to continue...");
                Console.ReadKey();
                Console.Clear();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            if (ex.InnerException != null)
                Console.WriteLine($"Inner Exception: {ex.InnerException.Message}");
        }
        finally
        {
            apiClient.Dispose();
        }
    }

    static void ShowMenu()
    {
        Console.WriteLine("=== Transaction Simulator Menu ===");
        Console.WriteLine("1. Create Single Transaction");
        Console.WriteLine("2. Create Multiple Transactions (Batch)");
        Console.WriteLine("3. Create Random Transactions (Simulation)");
        Console.WriteLine("4. Exit");
        Console.WriteLine();
        Console.Write("Select an option: ");
    }

    static async Task CreateSingleTransaction(ApiClient apiClient)
    {
        Console.WriteLine();
        Console.WriteLine("=== Create Single Transaction ===");
        Console.WriteLine();

        var transaction = ReadTransactionInput();
        if (transaction == null) return;

        try
        {
            Console.WriteLine();
            Console.WriteLine("Creating transaction...");
            var response = await apiClient.CreateTransactionAsync(transaction);
            
            Console.WriteLine("✓ Transaction created successfully!");
            Console.WriteLine($"  Transaction ID: {response.Id}");
            Console.WriteLine($"  Amount: {response.Amount:C}");
            Console.WriteLine($"  Risk Score: {response.RiskScore}");
            Console.WriteLine($"  Status: {response.Status}");
            Console.WriteLine($"  Flagged: {(response.IsFlagged ? "Yes" : "No")}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"✗ Error creating transaction: {ex.Message}");
        }
    }

    static async Task CreateMultipleTransactions(ApiClient apiClient)
    {
        Console.WriteLine();
        Console.WriteLine("=== Create Multiple Transactions ===");
        Console.WriteLine();

        Console.Write("How many transactions to create? ");
        if (!int.TryParse(Console.ReadLine(), out int count) || count <= 0)
        {
            Console.WriteLine("Invalid number.");
            return;
        }

        Console.WriteLine();
        Console.WriteLine("Enter base transaction details (will be used for all transactions):");
        var baseTransaction = ReadTransactionInput();
        if (baseTransaction == null) return;

        Console.WriteLine();
        Console.WriteLine($"Creating {count} transactions...");
        int successCount = 0;
        int failCount = 0;

        for (int i = 1; i <= count; i++)
        {
            try
            {
                // Vary the amount slightly for each transaction
                var transaction = baseTransaction with
                {
                    Amount = baseTransaction.Amount + (i * 1000),
                    SenderAccountNumber = baseTransaction.SenderAccountNumber.Replace("XXX", i.ToString("000")),
                    ReceiverAccountNumber = baseTransaction.ReceiverAccountNumber.Replace("XXX", i.ToString("000"))
                };

                var response = await apiClient.CreateTransactionAsync(transaction);
                successCount++;
                Console.WriteLine($"  [{i}/{count}] ✓ Created - Risk Score: {response.RiskScore}");
                
                // Small delay to avoid overwhelming the API
                await Task.Delay(100);
            }
            catch (Exception ex)
            {
                failCount++;
                Console.WriteLine($"  [{i}/{count}] ✗ Failed: {ex.Message}");
            }
        }

        Console.WriteLine();
        Console.WriteLine($"Summary: {successCount} succeeded, {failCount} failed");
    }

    static async Task CreateRandomTransactions(ApiClient apiClient)
    {
        Console.WriteLine();
        Console.WriteLine("=== Create Random Transactions (Simulation) ===");
        Console.WriteLine();

        Console.Write("How many transactions to create? ");
        if (!int.TryParse(Console.ReadLine(), out int count) || count <= 0)
        {
            Console.WriteLine("Invalid number.");
            return;
        }

        Console.Write("Delay between transactions (milliseconds, default 2000): ");
        var delayInput = Console.ReadLine();
        int delay = string.IsNullOrWhiteSpace(delayInput) ? 2000 : int.Parse(delayInput);

        Console.WriteLine();
        Console.WriteLine($"Creating {count} random transactions with {delay}ms delay...");
        Console.WriteLine("Press Ctrl+C to stop.");
        Console.WriteLine();

        var random = new Random();
        var transactionTypes = new[] { "Transfer", "Withdrawal", "Deposit", "Payment" };
        var devices = new[] { "iOS", "Android", "Web", "NewDevice", "MobileApp" };
        var locations = new[] { "NG-LAGOS", "NG-ABUJA", "NG-KANO", "NG-PORT-HARCOURT", "US-NEW-YORK", "UK-LONDON" };

        int successCount = 0;
        int failCount = 0;

        try
        {
            for (int i = 1; i <= count; i++)
            {
                var transaction = new TransactionRequest(
                    SenderAccountNumber: $"ACC{random.Next(1000000, 9999999)}",
                    ReceiverAccountNumber: $"ACC{random.Next(1000000, 9999999)}",
                    TransactionType: transactionTypes[random.Next(transactionTypes.Length)],
                    Amount: random.Next(10000, 5000000),
                    Location: locations[random.Next(locations.Length)],
                    Device: devices[random.Next(devices.Length)],
                    IpAddress: $"192.168.{random.Next(1, 255)}.{random.Next(1, 255)}"
                );

                try
                {
                    var response = await apiClient.CreateTransactionAsync(transaction);
                    successCount++;
                    var riskIndicator = response.RiskScore > 50 ? "⚠ HIGH RISK" : response.RiskScore > 0 ? "⚠ MEDIUM" : "✓ LOW";
                    Console.WriteLine($"[{i}/{count}] {riskIndicator} - Amount: {response.Amount:C}, Risk: {response.RiskScore}, Type: {transaction.TransactionType}");
                }
                catch (Exception ex)
                {
                    failCount++;
                    Console.WriteLine($"[{i}/{count}] ✗ Failed: {ex.Message}");
                }

                if (i < count)
                    await Task.Delay(delay);
            }
        }
        catch (OperationCanceledException)
        {
            Console.WriteLine();
            Console.WriteLine("Simulation cancelled by user.");
        }

        Console.WriteLine();
        Console.WriteLine($"Summary: {successCount} succeeded, {failCount} failed");
    }

    static TransactionRequest? ReadTransactionInput()
    {
        Console.Write("Sender Account Number: ");
        var senderAccount = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(senderAccount))
        {
            Console.WriteLine("Sender account number is required.");
            return null;
        }

        Console.Write("Receiver Account Number: ");
        var receiverAccount = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(receiverAccount))
        {
            Console.WriteLine("Receiver account number is required.");
            return null;
        }

        Console.Write("Transaction Type (Transfer/Withdrawal/Deposit/Payment): ");
        var transactionType = Console.ReadLine()?.Trim() ?? "Transfer";

        Console.Write("Amount: ");
        if (!decimal.TryParse(Console.ReadLine(), out decimal amount) || amount <= 0)
        {
            Console.WriteLine("Invalid amount.");
            return null;
        }

        Console.Write("Location (optional, e.g., NG-LAGOS): ");
        var location = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(location)) location = null;

        Console.Write("Device (optional, e.g., iOS, Android, NewDevice): ");
        var device = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(device)) device = null;

        Console.Write("IP Address (optional, e.g., 192.168.1.100): ");
        var ipAddress = Console.ReadLine()?.Trim();
        if (string.IsNullOrWhiteSpace(ipAddress)) ipAddress = null;

        return new TransactionRequest(
            senderAccount,
            receiverAccount,
            transactionType,
            amount,
            location,
            device,
            ipAddress
        );
    }

    static AppConfig? LoadConfiguration()
    {
        try
        {
            var configPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
            if (!File.Exists(configPath))
            {
                Console.WriteLine($"Configuration file not found at: {configPath}");
                return null;
            }

            var json = File.ReadAllText(configPath);
            var config = JsonSerializer.Deserialize<AppConfig>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return config;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error loading configuration: {ex.Message}");
            return null;
        }
    }
}

record AppConfig(string ApiBaseUrl, CredentialsConfig Credentials);
record CredentialsConfig(string Email, string Password);
