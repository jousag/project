// OpenWeatherMap API Key
const API_KEY = "4dde6e137f0d145d346da61d7086e193";

//Api key for weather data
const WEATHER_API_KEY = "d0ef5e5ed0644742aac165611252610";

// DOM Elements - will be initialized after DOM loads
let searchForm, cityInput, forecastContainer, errorMessage, loading, locationBtn;
let hourlyForecast, dailyForecast, tabButtons, hourlySection, dailySection;

let hourlyChart = null;

document.addEventListener('DOMContentLoaded', function() {
    searchForm = document.getElementById("search-form");
    cityInput = document.getElementById("city-input");
    forecastContainer = document.getElementById("forecast-container");
    errorMessage = document.getElementById("error-message");
    loading = document.getElementById("loading");
    locationBtn = document.getElementById("location-btn");
    hourlyForecast = document.getElementById("hourly-forecast");
    dailyForecast = document.getElementById("daily-forecast");
    tabButtons = document.querySelectorAll(".tab-btn");
    hourlySection = document.getElementById("hourly-forecast-section");
    dailySection = document.getElementById("daily-forecast-section");
    // Event Listeners
    if (searchForm) {
        searchForm.addEventListener("submit", handleSearch);
    }
    if (locationBtn) {
        locationBtn.addEventListener("click", handleLocationRequest);
    }
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
});

function switchTab(tab) {
    tabButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));
    hourlySection.classList.toggle("active", tab === "hourly");
    dailySection.classList.toggle("active", tab === "daily");
}

async function handleSearch(e) {
    e.preventDefault();
    const cityName = cityInput.value.trim();
    if (!cityName) {
        showError("Please enter a city name");
        return;
    }
    hideForecast();
    hideError();
    showLoading();

    try {
        const coordinates = await getCityCoordinates(cityName);
        const forecastData = await getForecastData(coordinates.lat, coordinates.lon);
        displayForecast(forecastData, coordinates);
    } catch (error) {
        showError(error.message || 'Failed to fetch forecast for the specified city.');
    } finally {
        hideLoading();
    }
}

async function handleLocationRequest() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser");
        return;
    }
    hideForecast();
    hideError();
    showLoading();
    locationBtn.disabled = true;
    locationBtn.textContent = "📍 Getting location...";
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
        const { latitude, longitude } = position.coords;
        const forecastData = await getForecastData(latitude, longitude);
        const city = (forecastData && forecastData.city) ? forecastData.city : {};
        const coordinates = {
            lat: latitude,
            lon: longitude,
            name: city.name || "Your Location",
            country: city.country || "",
            state: ""
        };
        displayForecast(forecastData, coordinates);
    } catch (error) {
        if (error.code === 1) {
            showError("Location access denied. Please enable location permissions.");
        } else if (error.code === 2) {
            showError("Location unavailable. Please check your device settings.");
        } else if (error.code === 3) {
            showError("Location request timed out. Please try again.");
        } else {
            showError(error.message || "Unable to get your location");
        }
    } finally {
        hideLoading();
        locationBtn.disabled = false;
        locationBtn.textContent = "📍 My Location";
    }
}


async function getCityCoordinates(cityName) {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data || data.length === 0) {
        throw new Error(`City "${cityName}" not found. Please try another city.`);
    }
    
    const city = data[0];
    return {
        lat: city.lat,
        lon: city.lon,
        name: city.name,
        country: city.country,
        state: city.state || ""
    };
}



async function getForecastData(lat, lon) {
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch forecast data");
    }

    const data = await response.json();
    console.log('Forecast data fetched:', data);
    return {
        city: null,
        hourly: Array.isArray(data.hourly) ? data.hourly : [],
        daily: groupByDay(Array.isArray(data.daily) ? data.daily : [])
    };
}

function groupByDay(forecastList) {
    return forecastList.slice(0, 7).map(day => ({
        dt: day.dt,
        temp: day.temp || { min: null, max: null },
        weather: day.weather || [{ description: '', icon: '' }],
        humidity: day.humidity || null,
        wind_speed: day.wind_speed || null,
        pop: Math.round((day.pop || 0) * 100)
    }));
}

function displayForecast(data, coordinates) {
    document.getElementById("city-name").textContent = `${coordinates.name}${coordinates.country ? ", " + coordinates.country : ""}`;
    document.getElementById("coordinates").textContent = `Lat: ${coordinates.lat.toFixed(4)}, Lon: ${coordinates.lon.toFixed(4)}`;

    hourlyForecast.innerHTML = "";
    dailyForecast.innerHTML = "";

    createHourlyChart(data.hourly);
    data.hourly.forEach((hour, index) => {
        const card = createHourlyCard(hour, index === 0);
        hourlyForecast.appendChild(card);
    });

    data.daily.forEach((day, index) => {
        const card = createDailyCard(day, index === 0);
        dailyForecast.appendChild(card);
    });
    showForecast();
}

function createHourlyChart(hourlyData) {
    const fullLabels = hourlyData.map(hour => {
        const date = new Date(hour.dt * 1000);
        return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    });

    const labels = fullLabels.map(() => '');

    const datasets = [
        {
            name: "Temperature",
            values: hourlyData.map(hour => hour && (typeof hour.temp !== 'undefined') ? Math.round(hour.temp) : null),
            chartType: "line",
        },
        {
            name: "Feels Like",
            values: hourlyData.map(hour => hour && (typeof hour.feels_like !== 'undefined') ? Math.round(hour.feels_like) : null),
            chartType: "line",
        },
        {
            name: "Rain (mm/h)",
            values: hourlyData.map(hour => {
                let rain = 0;
                if (hour && hour.rain) {
                    if (typeof hour.rain['1h'] !== 'undefined') rain = hour.rain['1h'];
                }
                rain = Number(rain) || 0;
                return rain < 0 ? 0 : rain;
            }),
            chartType: "bar",
            y2Axis: true,
        },
    ];

    if (hourlyChart) {
        hourlyChart = null;
    }

    const chartContainer = document.getElementById("hourly-chart");
    chartContainer.innerHTML = "";
    const chartData = {
        labels: labels,
        datasets: datasets,
    };

    if (chartContainer.clientWidth === 0) {
        setTimeout(() => createHourlyChart(hourlyData), 120);
        return;
    }

    hourlyChart = new frappe.Chart("#hourly-chart", {
        title: "Temperature & Weather Conditions",
        data: chartData,
        type: "axis-mixed",
        height: 300,
        colors: ["#ff6b6b", "#ffa726", "#4dabf7"],
        lineOptions: {
            regionFill: 1,
            hideDots: 0,
            heatline: 0,
            spline: 1
        },
        barOptions: {
            spaceRatio: 0.2
        },
        axisOptions: {
            xAxisMode: "tick",
            xIsSeries: false,
            yAxisMode: "span",
            y2AxisMode: "span"
        },
        tooltipOptions: {
            formatTooltipX: function(label, i) {
                if (label && String(label).trim()) return label;
                if (typeof i !== 'undefined' && fullLabels[i]) return fullLabels[i];
                return label || '';
            },
            formatTooltipY: function(value, idx) {
                return (typeof idx !== 'undefined' && idx === 2) ? value + " mm/h" : value + "°C";
            }
        }
    });
}

function createHourlyCard(hourData, isNow) {
    const card = document.createElement("div");
    card.className = "forecast-card";
    
    
    const date = new Date(hourData.dt * 1000);
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const timeString = isNow ? "Now" : date.toLocaleTimeString("en-US", options);
    const dateString = date.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
    });
    
    
    const temp = (typeof hourData.temp !== 'undefined') ? Math.round(hourData.temp) : '';
    const feelsLike = (typeof hourData.feels_like !== 'undefined') ? Math.round(hourData.feels_like) : '';
    const description = (hourData.weather && hourData.weather[0]) ? hourData.weather[0].description : '';
    const icon = (hourData.weather && hourData.weather[0]) ? hourData.weather[0].icon : '';
    const humidity = (typeof hourData.humidity !== 'undefined') ? hourData.humidity : '';
    const windSpeed = (typeof hourData.wind_speed !== 'undefined') ? hourData.wind_speed : '';
    const pop = Math.round((hourData.pop || 0) * 100);
    
    card.innerHTML = `
        <div class="forecast-time">
            <strong>${timeString}</strong>
            <span class="forecast-date">${dateString}</span>
        </div>
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" 
             alt="${description}" 
             class="forecast-icon">
        <div class="forecast-temp">${temp}°C</div>
        <div class="forecast-description">${description.charAt(0).toUpperCase() + description.slice(1)}</div>
        <div class="forecast-details">
            <div class="detail-row">
                <span>💧 ${humidity}%</span>
                <span>💨 ${windSpeed} m/s</span>
            </div>
            <div class="detail-row">
                <span>Feels ${feelsLike}°C</span>
                ${pop > 0 ? `<span>🌧️ ${pop}%</span>` : ""}
            </div>
        </div>
    `;
    
    return card;
}

function createDailyCard(dayData, isToday) {
    const card = document.createElement("div");
    card.className = "forecast-card daily-card";
    
    
    const date = new Date(dayData.dt * 1000);
    const dayName = isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "long" });
    const dateString = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    
    const tempMax = Math.round(dayData.temp.max);
    const tempMin = Math.round(dayData.temp.min);
    const description = dayData.weather[0].description;
    const icon = dayData.weather[0].icon;
    const humidity = dayData.humidity;
    const windSpeed = dayData.wind_speed.toFixed(1);
    const pop = dayData.pop || 0;
    
    card.innerHTML = `
        <div class="forecast-day">
            <strong>${dayName}</strong>
            <span class="forecast-date">${dateString}</span>
        </div>
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" 
             alt="${description}" 
             class="forecast-icon">
        <div class="forecast-temp-range">
            <span class="temp-max">${tempMax}°</span>
            <span class="temp-divider">/</span>
            <span class="temp-min">${tempMin}°</span>
        </div>
        <div class="forecast-description">${description.charAt(0).toUpperCase() + description.slice(1)}</div>
        <div class="forecast-details">
            <div class="detail-row">
                <span>💧 ${humidity}%</span>
                <span>💨 ${windSpeed} m/s</span>
            </div>
            ${pop > 0 ? `<div class="detail-row"><span>🌧️ ${pop}% chance</span></div>` : ""}
        </div>
    `;
    
    return card;
}

function showLoading() {
    loading.classList.remove("hidden");
}

function hideLoading() {
    loading.classList.add("hidden");
}

function showForecast() {
    forecastContainer.classList.remove("hidden");
}

function hideForecast() {
    forecastContainer.classList.add("hidden");
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

function hideError() {
    errorMessage.classList.add("hidden");
}
