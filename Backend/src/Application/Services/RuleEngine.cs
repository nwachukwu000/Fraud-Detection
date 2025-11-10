using Application.DTOs;
using Domain.Entities;
using FDMA.Application.DTOs;
using FDMA.Domain.Entities;
using FDMA.Domain.Enums;

namespace FDMA.Application.Services;

public  class RuleEngine
{
    
    private static void TriggerAction(Transaction transaction, FDMA.Domain.Entities.Rule rule, List<Rule> enabledRules, RiskResult riskResult)
    {
        var totalWeight = enabledRules.Sum(r => (int)r.Severity);
        riskResult.Score += (totalWeight / (enabledRules.Count * rule.Severity)) * 100;
        var RiskResultScore = Math.Min(riskResult.Score, 100);
        var triggeredRule = new TriggeredRules
        {
            TransactionId = transaction.Id,
            RuleId = rule.Id
        };
        riskResult.TriggeredRules.Add(triggeredRule);
        //await _triggeredRuleRepo.AddAsync(triggeredRule);

        var alert = new Alert
        {
            TransactionId = transaction.Id,
            Severity = Enum.GetName(typeof(AlertSeverity), rule.Severity) ?? "",
            RuleReason = rule.Name
        };
        riskResult.Alert = alert;
        // todo: raise alert notification here...
        // todo: add alert to db here...
    }
    public static RiskResult ComputeRiskScore(Transaction transaction, IEnumerable<Rule> rules)
    {
        //int score = 0;
        //foreach (var r in rules.Where(r => r.IsEnabled))
        //{
        //    var fieldValue = r.Field.ToLowerInvariant() switch
        //    {
        //        "amount" => t.Amount.ToString(),
        //        "device" => t.Device ?? "",
        //        "location" => t.Location ?? "",
        //        "transactiontype" => t.TransactionType,
        //        _ => ""
        //    };
        //    bool match = r.Condition.ToLowerInvariant() switch
        //    {
        //        "greaterthan" when decimal.TryParse(fieldValue, out var tv) && decimal.TryParse(r.Value, out var rv) => tv > rv,
        //        "equals" => string.Equals(fieldValue, r.Value, StringComparison.OrdinalIgnoreCase),
        //        "in" => r.Value.Split(',').Select(s => s.Trim()).Contains(fieldValue, StringComparer.OrdinalIgnoreCase),
        //        "notin" => !r.Value.Split(',').Select(s => s.Trim()).Contains(fieldValue, StringComparer.OrdinalIgnoreCase),
        //        _ => false
        //    };
        //    if (match) score += 15;
        //}
        //return Math.Min(score, 100);
        var enabledRules = rules.Where(r => r.IsEnabled).ToList();
   
        var result = new RiskResult();
        try
        {
            #region todo: I will refactor this code later to use the strategy pattern
            foreach (var rule in rules)
            {
                if (rule.Field.Equals("amount", StringComparison.CurrentCultureIgnoreCase) && rule.Condition.Equals("greater than", StringComparison.CurrentCultureIgnoreCase))
                {
                    if (transaction.Amount > Convert.ToInt32(rule.Value))
                         TriggerAction(transaction, rule,enabledRules, result);
                }

                if (rule.Field.Equals("location", StringComparison.CurrentCultureIgnoreCase) && rule.Condition.Equals("not equal", StringComparison.CurrentCultureIgnoreCase))
                {
                    if (transaction.Location != rule.Value)
                        TriggerAction(transaction, rule, enabledRules, result);
                }

                if (rule.Field.Equals("status", StringComparison.CurrentCultureIgnoreCase) && rule.Condition.Equals("not equal", StringComparison.CurrentCultureIgnoreCase))
                {
                    if (transaction.Location != rule.Value)
                         TriggerAction(transaction, rule, enabledRules, result);
                }
            }
            #endregion

            transaction.RiskScore = result.Score;
            result.Transaction = transaction;
            // todo: add transaction to db here...
        }
        catch
        {
            // rollback in case of fails
            throw;
        }
        return result;
    }
}