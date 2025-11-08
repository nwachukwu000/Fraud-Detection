namespace FDMA.Domain.Entities;

public class Rule
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!; // e.g., High Value Transaction
    public string Field { get; set; } = default!; // Amount, Device, Location
    public string Condition { get; set; } = default!; // GreaterThan, Equals, In, NotIn
    public string Value { get; set; } = default!; // "500000", "NG-LAGOS"
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}