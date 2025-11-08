using FDMA.Domain.Entities;

namespace FDMA.Application.Services;

public static class RuleEngine
{
    // very basic evaluator just for demo (string compare + greater than for Amount)
    public static int ComputeRiskScore(Transaction t, IEnumerable<Rule> rules)
    {
        int score = 0;
        foreach (var r in rules.Where(r => r.IsEnabled))
        {
            var fieldValue = r.Field.ToLowerInvariant() switch
            {
                "amount" => t.Amount.ToString(),
                "device" => t.Device ?? "",
                "location" => t.Location ?? "",
                "transactiontype" => t.TransactionType,
                _ => ""
            };
            bool match = r.Condition.ToLowerInvariant() switch
            {
                "greaterthan" when decimal.TryParse(fieldValue, out var v) && decimal.TryParse(r.Value, out var th) => v > th,
                "equals" => string.Equals(fieldValue, r.Value, StringComparison.OrdinalIgnoreCase),
                "in" => r.Value.Split(',').Select(s => s.Trim()).Contains(fieldValue, StringComparer.OrdinalIgnoreCase),
                "notin" => !r.Value.Split(',').Select(s => s.Trim()).Contains(fieldValue, StringComparer.OrdinalIgnoreCase),
                _ => false
            };
            if (match) score += 50;
        }
        return Math.Min(score, 100);
    }
}