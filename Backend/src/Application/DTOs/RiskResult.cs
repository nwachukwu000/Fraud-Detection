using Domain.Entities;
using FDMA.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Application.DTOs
{
    public class RiskResult
    {
            public int Score { get; set; }
            public Transaction? Transaction { get; set; }
            public Alert? Alert { get; set; }
            public List<TriggeredRules> TriggeredRules { get; set; } = [];
       
    }
}
