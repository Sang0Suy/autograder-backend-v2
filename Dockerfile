# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY . . 
RUN dotnet publish "AutoGrader.API/AutoGrader.API.csproj" -c Release -o /app/publish

# Run stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final

# 🔥 Cài bộ OpenCV gốc cực mạnh để bao trọn mọi lỗi thiếu file
RUN apt-get update && apt-get install -y \
    libopencv-dev \
    libgdiplus \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "AutoGrader.API.dll"]