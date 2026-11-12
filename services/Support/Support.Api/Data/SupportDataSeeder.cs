namespace Support.Api.Data;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Support.Api.Domain.Entities;

public sealed class SupportDataSeeder(IServiceProvider serviceProvider, ILogger<SupportDataSeeder> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SupportDbContext>();

        await db.Database.MigrateAsync(cancellationToken);

        if (!await db.Tutorials.AnyAsync(cancellationToken))
        {
            logger.LogInformation("Đang seed dữ liệu mẫu Tutorials cho support_db...");

            db.Tutorials.AddRange(
                new Tutorial
                {
                    Id = Guid.NewGuid(),
                    Title = "Kỹ thuật Naked Single (Ô đơn độc)",
                    Summary = "Kỹ thuật cơ bản nhất trong Sudoku: khi một ô chỉ còn duy nhất 1 số khả dĩ.",
                    Content = "Naked Single xảy ra khi tất cả các số khác (từ 1 đến 9) đã xuất hiện trong cùng hàng, cột hoặc khối 3x3 chứa ô đó. Khi đó ô này chỉ có thể nhận đúng giá trị còn lại.",
                    Category = "Technique",
                    Difficulty = "Easy",
                    SortOrder = 1,
                    IsPublished = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Tutorial
                {
                    Id = Guid.NewGuid(),
                    Title = "Kỹ thuật Hidden Single (Số ẩn độc nhất)",
                    Summary = "Một chữ số chỉ có thể nằm ở đúng một vị trí trong cả hàng, cột hoặc khối.",
                    Content = "Dù ô đó có thể còn nhiều ghi chú ứng viên, nhưng nếu xét cả hàng (hoặc cột/khối) mà một chữ số chỉ có thể đặt ở ô đó, bạn có thể điền ngay số đó.",
                    Category = "Technique",
                    Difficulty = "Easy",
                    SortOrder = 2,
                    IsPublished = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Tutorial
                {
                    Id = Guid.NewGuid(),
                    Title = "Chiến thuật Pointing Pairs / Triples",
                    Summary = "Khi các ứng viên của một số trong khối nằm thẳng hàng hoặc cột.",
                    Content = "Nếu một số trong khối 3x3 chỉ có thể nằm trên 1 hàng (hoặc cột), thì ở phần còn lại của hàng (hoặc cột) bên ngoài khối đó chắc chắn không thể chứa số đó. Ta có thể loại bỏ ứng viên đó ra.",
                    Category = "Strategy",
                    Difficulty = "Medium",
                    SortOrder = 3,
                    IsPublished = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                },
                new Tutorial
                {
                    Id = Guid.NewGuid(),
                    Title = "Kỹ thuật nâng cao: X-Wing",
                    Summary = "Khóa ứng viên trên 4 góc của một hình chữ nhật tạo bởi 2 hàng và 2 cột.",
                    Content = "Khi một số chỉ xuất hiện ở 2 vị trí trên hàng A và đúng 2 cột tương ứng trên hàng B, số đó buộc phải nằm ở 1 trong 2 đường chéo, cho phép xóa ứng viên đó ở toàn bộ phần còn lại của 2 cột đó.",
                    Category = "Strategy",
                    Difficulty = "Hard",
                    SortOrder = 4,
                    IsPublished = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            );
        }

        if (!await db.SystemNotices.AnyAsync(cancellationToken))
        {
            logger.LogInformation("Đang seed dữ liệu mẫu SystemNotices cho support_db...");

            db.SystemNotices.AddRange(
                new SystemNotice
                {
                    Id = Guid.NewGuid(),
                    Title = "Chào mừng bạn đến với Nền tảng Sudoku Online Platform!",
                    Content = "Hệ thống hỗ trợ giải đố Sudoku solo thông minh, hướng dẫn Smart Hint từng bước và thi đấu đối kháng thời gian thực 1v1.",
                    Category = "Notice",
                    IsPinned = true,
                    PublishedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                },
                new SystemNotice
                {
                    Id = Guid.NewGuid(),
                    Title = "Cập nhật Chế độ Chơi Mới: Shuffle / Irregular Sudoku",
                    Content = "Bạn hiện đã có thể trải nghiệm các layout Sudoku biến thể với 9 khối hình dạng tự do đầy thử thách.",
                    Category = "Update",
                    IsPinned = false,
                    PublishedAt = DateTime.UtcNow.AddHours(-12),
                    CreatedAt = DateTime.UtcNow.AddHours(-12)
                }
            );
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
