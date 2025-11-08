using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionIdToCase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TransactionId",
                table: "Cases",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateIndex(
                name: "IX_Cases_TransactionId",
                table: "Cases",
                column: "TransactionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cases_Transactions_TransactionId",
                table: "Cases",
                column: "TransactionId",
                principalTable: "Transactions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cases_Transactions_TransactionId",
                table: "Cases");

            migrationBuilder.DropIndex(
                name: "IX_Cases_TransactionId",
                table: "Cases");

            migrationBuilder.DropColumn(
                name: "TransactionId",
                table: "Cases");
        }
    }
}
