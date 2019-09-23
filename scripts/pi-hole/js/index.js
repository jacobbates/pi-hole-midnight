/* Pi-hole: A black hole for Internet advertisements
*  (c) 2017 Pi-hole, LLC (https://pi-hole.net)
*  Network-wide ad blocking via your own hardware.
*
*  This file is copyright under the latest version of the EUPL.
*  Please see LICENSE file for your rights under this license. */
// Define global variables
/* global Chart */
var timeLineChart, queryTypeChart, forwardDestinationChart;
var queryTypePieChart, forwardDestinationPieChart, clientsChart;

function padNumber(num) {
    return ("00" + num).substr(-2, 2);
}

// Helper function needed for converting the Objects to Arrays

function objectToArray(p) {
    var keys = Object.keys(p);
    keys.sort(function (a, b) {
        return a - b;
    });

    var arr = [], idx = [];
    for (var i = 0; i < keys.length; i++) {
        arr.push(p[keys[i]]);
        idx.push(keys[i]);
    }
    return [idx, arr];
}

var lastTooltipTime = 0;

var customTooltips = function (tooltip) {
    // Tooltip Element
    var tooltipEl = document.getElementById("chartjs-tooltip");
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.id = "chartjs-tooltip";
        document.body.appendChild(tooltipEl);
        $(tooltipEl).html("<table></table>");
    }
    // Hide if no tooltip
    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    // Limit rendering to once every 50ms. This gives the DOM time to react,
    // and avoids "lag" caused by not giving the DOM time to reapply CSS.
    var now = Date.now();
    if (now - lastTooltipTime < 50) {
        return;
    }
    lastTooltipTime = now;

    // Set caret Position
    tooltipEl.classList.remove("above", "below", "no-transform");
    if (tooltip.yAlign) {
        tooltipEl.classList.add(tooltip.yAlign);
    } else {
        tooltipEl.classList.add("above");
    }
    function getBody(bodyItem) {
        return bodyItem.lines;
    }
    // Set Text
    if (tooltip.body) {
        var titleLines = tooltip.title || [];
        var bodyLines = tooltip.body.map(getBody);
        var innerHtml = "<table><thead>";
        titleLines.forEach(function (title) {
            innerHtml += "<tr><th>" + title + "</th></tr>";
        });
        innerHtml += "</thead><tbody>";
        var printed = 0;
        bodyLines.forEach(function (body, i) {
            var colors = tooltip.labelColors[i];
            var style = "background:" + colors.backgroundColor;
            style += "; border-color:" + colors.borderColor;
            style += "; border-width: 2px";
            var span = "<span class=\"chartjs-tooltip-key\" style=\"" + style + "\"></span>";
            var num = body[0].split(": ");
            // remove percent symbol from amount to allow numeric comparison
            var number = num[1].replace(/%/i, "");
            if (number > 0) {
                innerHtml += "<tr><td>" + span + body + "</td></tr>";
                printed++;
            }
        });
        if (printed < 1) {
            innerHtml += "<tr><td>No activity recorded</td></tr>";
        }
        innerHtml += "</tbody></table>";
        $(tooltipEl).html(innerHtml);
    }

    // Display, position, and set styles for font
    var position = this._chart.canvas.getBoundingClientRect();
    var width = tooltip.caretX;
    // Prevent compression of the tooltip at the right edge of the screen
    if ($(document).width() - tooltip.caretX < 400) {
        width = $(document).width() - 400;
    }
    // Prevent tooltip disapearing behind the sidebar
    if (tooltip.caretX < 100) {
        width = 100;
    }
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = position.left + width + "px";
    tooltipEl.style.top = position.top + tooltip.caretY + window.scrollY + "px";
    tooltipEl.style.fontFamily = tooltip._bodyFontFamily;
    tooltipEl.style.fontSize = tooltip.bodyFontSize + "px";
    tooltipEl.style.fontStyle = tooltip._bodyFontStyle;
    tooltipEl.style.padding = tooltip.yPadding + "px " + tooltip.xPadding + "px";
};

// Functions to update data in page

var failures = 0;
function updateQueriesOverTime() {
    $.getJSON("api.php?overTimeData10mins", function (data) {

        if ("FTLnotrunning" in data) {
            return;
        }

        // convert received objects to arrays
        data.domains_over_time = objectToArray(data.domains_over_time);
        data.ads_over_time = objectToArray(data.ads_over_time);
        // remove last data point since it not representative
        data.ads_over_time[0].splice(-1, 1);
        // Remove possibly already existing data
        timeLineChart.data.labels = [];
        timeLineChart.data.datasets[0].data = [];
        timeLineChart.data.datasets[1].data = [];

        // Add data for each hour that is available
        for (var hour in data.ads_over_time[0]) {
            if ({}.hasOwnProperty.call(data.ads_over_time[0], hour)) {
                var d, h;
                h = parseInt(data.domains_over_time[0][hour]);
                if (parseInt(data.ads_over_time[0][0]) < 1200) {
                    // Fallback - old style
                    d = new Date().setHours(Math.floor(h / 6), 10 * (h % 6), 0, 0);
                }
                else {
                    // New style: Get Unix timestamps
                    d = new Date(1000 * h);
                }

                timeLineChart.data.labels.push(d);
                timeLineChart.data.datasets[0].data.push(data.domains_over_time[1][hour]);
                timeLineChart.data.datasets[1].data.push(data.ads_over_time[1][hour]);
            }
        }
        $("#queries-over-time .overlay").hide();
        timeLineChart.update();
    }).done(function () {
        // Reload graph after 10 minutes
        failures = 0;
        setTimeout(updateQueriesOverTime, 600000);
    }).fail(function () {
        failures++;
        if (failures < 5) {
            // Try again after 1 minute only if this has not failed more
            // than five times in a row
            setTimeout(updateQueriesOverTime, 60000);
        }
    });
}

function updateQueryTypesPie() {
    $.getJSON("api.php?getQueryTypes", function (data) {

        if ("FTLnotrunning" in data) {
            return;
        }

        var colors = [];
        // Get colors from AdminLTE
        $.each($.AdminLTE.options.colors, function (key, value) { colors.push(value); });
        var v = [], c = [], k = [], iter;
        // Collect values and colors, and labels
        if (data.hasOwnProperty("querytypes")) {
            iter = data.querytypes;
        }
        else {
            iter = data;
        }
        var dd = []; 
        $.each(iter, function (key, value) {
            v = [value];
            c = colors.shift();
            k = key ;
        dd.push({data: v, backgroundColor: c, label: k});
        });
        dd.sort((a,b) => (a.data[0] < b.data[0]) ? 1 : -1);
        //dd.sort((a,b) => (a[1] < b[1]) ? 1 : -1)
        // Build a single dataset with the data to be pushed
        // and push it at once
        queryTypePieChart.data.labels = ["Type"];
        queryTypePieChart.data.datasets = [];
        $.each(dd, function(key,value){
            queryTypePieChart.data.datasets.push(dd[key]);
        });
        $("#query-types-pie .overlay").hide();
        queryTypePieChart.update();
        queryTypePieChart.chart.config.options.cutoutPercentage = 50;
        queryTypePieChart.update();
        // Don't use rotation animation for further updates
        queryTypePieChart.options.animation.duration = 0;
        // Generate legend in separate div
        $("#query-types-legend").html(queryTypePieChart.generateLegend());
        $("#query-types-legend > ul > li").on("mousedown", function (e) {
            if (e.which === 2) // which == 2 is middle mouse button
            {
                $(this).toggleClass("strike");
                var index = $(this).index();
                var ci = e.view.queryTypePieChart;
                var meta = ci.data.datasets[0]._meta;
                for (let i in meta) {
                    if ({}.hasOwnProperty.call(meta, i)) {
                        var curr = meta[i].data[index];
                        curr.hidden = !curr.hidden;
                    }
                }
                ci.update();
            }
            else if (e.which === 1) // which == 1 is left mouse button
            {
                window.open("queries.php?querytype=" + ($(this).index() + 1), "_self");
            }
        });
    }).done(function () {
        // Reload graph after minute
        setTimeout(updateQueryTypesPie, 60000);
    });
}

function updateClientsOverTime() {
    $.getJSON("api.php?overTimeDataClients&getClientNames", function (data) {

        if ("FTLnotrunning" in data) {
            return;
        }

        // convert received objects to arrays
        data.over_time = objectToArray(data.over_time);

        // Remove graph if there are no results (e.g. privacy mode enabled)
        if (jQuery.isEmptyObject(data.over_time)) {
            $("#clients").parent().remove();
            return;
        }
        // remove last data point since it not representative
        data.over_time[0].splice(-1, 1);
        var timestamps = data.over_time[0];
        var plotdata = data.over_time[1];
        var labels = [];
        var key, i, j;
        for (key in data.clients) {
            if (!{}.hasOwnProperty.call(data.clients, key)) {
                continue;
            }
            var clientname;
            if (data.clients[key].name.length > 0) {
                clientname = data.clients[key].name;
            }
            else {
                clientname = data.clients[key].ip;
            }
            labels.push(clientname);
        }
        // Get colors from AdminLTE
        var colors = [];
        $.each($.AdminLTE.options.colors, function (key, value) { colors.push(value); });
        var v = [], c = [], k = [];

        // Remove possibly already existing data
        clientsChart.data.labels = [];
        clientsChart.data.datasets[0].data = [];
        for (i = 1; i < clientsChart.data.datasets.length; i++) {
            clientsChart.data.datasets[i].data = [];
        }

        // Collect values and colors, and labels
        clientsChart.data.datasets[0].backgroundColor = "transparent";
        clientsChart.data.datasets[0].borderColor = colors[0]
        clientsChart.data.datasets[0].pointRadius = 0;
        clientsChart.data.datasets[0].pointHitRadius = 5;
        clientsChart.data.datasets[0].pointHoverRadius = 5;
        clientsChart.data.datasets[0].label = labels[0];

        for (i = clientsChart.data.datasets.length; plotdata.length && i < plotdata[0].length; i++) {
            clientsChart.data.datasets.push({
                data: [],
                // If we ran out of colors, make a random one
                borderColor: i < colors.length
                    ? colors[i]
                    : "#" + parseInt("" + Math.random() * 0xffffff, 10).toString(16).padStart(6, "0"),
                backgroundColor: "transparent",
                pointRadius: 0,
                pointHitRadius: 5,
                pointHoverRadius: 5,
                label: labels[i],
                cubicInterpolationMode: "monotone"
            });
        }

        // Add data for each dataset that is available
        for (j in timestamps) {
            if (!{}.hasOwnProperty.call(timestamps, j)) {
                continue;
            }
            for (key in plotdata[j]) {
                if (!{}.hasOwnProperty.call(plotdata[j], key)) {
                    continue;
                }
                clientsChart.data.datasets[key].data.push(plotdata[j][key]);
            }

            var d = new Date(1000 * parseInt(timestamps[j]));
            clientsChart.data.labels.push(d);
        }
        $("#clients .overlay").hide();
        clientsChart.update();
    }).done(function () {
        // Reload graph after 10 minutes
        failures = 0;
        setTimeout(updateClientsOverTime, 600000);
    }).fail(function () {
        failures++;
        if (failures < 5) {
            // Try again after 1 minute only if this has not failed more
            // than five times in a row
            setTimeout(updateClientsOverTime, 60000);
        }
    });
}

function updateForwardDestinationsPie() {
    $.getJSON("api.php?getForwardDestinations", function (data) {

        if ("FTLnotrunning" in data) {
            return;
        }

        var colors = [];
        // Get colors from AdminLTE
        $.each($.AdminLTE.options.colors, function (key, value) { colors.push(value); });
        var v = [], c = [], k = [], values = [];

        // Collect values and colors
        $.each(data.forward_destinations, function (key, value) {
            if (key.indexOf("|") > -1) {
                key = key.substr(0, key.indexOf("|"));
            }
            values.push([key, value, colors.shift()]);
        });
	    var dd = []; 
	    values.sort((a,b) => (a[1] < b[1]) ? 1 : -1)
        // Split data into individual arrays for the graphs
	$.each(values, function (key, value) {
            k = value[0];
            v = [value[1]];
            c = value[2];
	    dd.push({data: v, backgroundColor: c, label: k});
        });
        // Build a single dataset with the data to be pushed
        // and push it at once
        forwardDestinationPieChart.data.labels = ["Destination"];
	forwardDestinationPieChart.data.datasets = [];
	$.each(dd, function(key,value){
	    forwardDestinationPieChart.data.datasets.push(dd[key]);
	});
        // and push it at once
        $("#forward-destinations-pie .overlay").hide();
        forwardDestinationPieChart.update();
        forwardDestinationPieChart.chart.config.options.cutoutPercentage = 50;
        forwardDestinationPieChart.update();
        // Don't use rotation animation for further updates
        forwardDestinationPieChart.options.animation.duration = 0;
        // Generate legend in separate div
        $("#forward-destinations-legend").html(forwardDestinationPieChart.generateLegend());
        $("#forward-destinations-legend > ul > li").on("mousedown", function (e) {
            if (e.which === 2) // which == 2 is middle mouse button
            {
                $(this).toggleClass("strike");
                var index = $(this).index();
                var ci = e.view.forwardDestinationPieChart;
                var meta = ci.data.datasets[0]._meta;
                for (let i in meta) {
                    if ({}.hasOwnProperty.call(meta, i)) {
                        var curr = meta[i].data[index];
                        curr.hidden = !curr.hidden;
                    }
                }
                ci.update();
            }
            else if (e.which === 1) // which == 1 is left mouse button
            {
                var obj = encodeURIComponent(e.target.innerText);
                window.open("queries.php?forwarddest=" + obj, "_self");
            }
        });
    }).done(function () {
        // Reload graph after one minute
        setTimeout(updateForwardDestinationsPie, 60000);
    });
}

// Credit: http://stackoverflow.com/questions/1787322/htmlspecialchars-equivalent-in-javascript/4835406#4835406
function escapeHtml(text) {
    var map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "\'": "&#039;"
    };

    return text.replace(/[&<>"']/g, function (m) { return map[m]; });
}

function updateTopClientsChart() {
    $.getJSON("api.php?summaryRaw&getQuerySources&topClientsBlocked", function (data) {

        if ("FTLnotrunning" in data) {
            return;
        }

        // Clear tables before filling them with data
        $("#client-frequency td").parent().remove();
        var clienttable = $("#client-frequency").find("tbody:last");
        var client, percentage, clientname, clientip, idx, url;
        for (client in data.top_sources) {

            if ({}.hasOwnProperty.call(data.top_sources, client)) {
                // Sanitize client
                if (escapeHtml(client) !== client) {
                    // Make a copy with the escaped index if necessary
                    data.top_sources[escapeHtml(client)] = data.top_sources[client];
                }
                client = escapeHtml(client);
                if (client.indexOf("|") > -1) {
                    idx = client.indexOf("|");
                    clientname = client.substr(0, idx);
                    clientip = client.substr(idx + 1, client.length - idx);
                }
                else {
                    clientname = client;
                    clientip = client;
                }

                url = "<a href=\"queries.php?client=" + clientip + "\" title=\"" + clientip + "\">" + clientname + "</a>";
                percentage = data.top_sources[client] / data.dns_queries_today * 100;
                clienttable.append("<tr> <td>" + url +
                    "</td> <td>" + data.top_sources[client] + "</td> <td> <div class=\"progress progress-sm\" title=\"" + percentage.toFixed(1) + "% of " + data.dns_queries_today + "\"> <div class=\"progress-bar progress-bar-blue\" style=\"width: " +
                    percentage + "%\"></div> </div> </td> </tr> ");
            }
        }

        // Clear tables before filling them with data
        $("#client-frequency-blocked td").parent().remove();
        var clientblockedtable = $("#client-frequency-blocked").find("tbody:last");
        for (client in data.top_sources_blocked) {

            if ({}.hasOwnProperty.call(data.top_sources_blocked, client)) {
                // Sanitize client
                if (escapeHtml(client) !== client) {
                    // Make a copy with the escaped index if necessary
                    data.top_sources_blocked[escapeHtml(client)] = data.top_sources_blocked[client];
                }
                client = escapeHtml(client);
                if (client.indexOf("|") > -1) {
                    idx = client.indexOf("|");
                    clientname = client.substr(0, idx);
                    clientip = client.substr(idx + 1, client.length - idx);
                }
                else {
                    clientname = client;
                    clientip = client;
                }

                url = "<a href=\"queries.php?client=" + clientip + "\" title=\"" + clientip + "\">" + clientname + "</a>";
                percentage = data.top_sources_blocked[client] / data.ads_blocked_today * 100;
                clientblockedtable.append("<tr> <td>" + url +
                    "</td> <td>" + data.top_sources_blocked[client] + "</td> <td> <div class=\"progress progress-sm\" title=\"" + percentage.toFixed(1) + "% of " + data.dns_queries_today + "\"> <div class=\"progress-bar progress-bar-blue\" style=\"width: " +
                    percentage + "%\"></div> </div> </td> </tr> ");
            }
        }

        // Remove table if there are no results (e.g. privacy mode enabled)
        if (jQuery.isEmptyObject(data.top_sources)) {
            $("#client-frequency").parent().remove();
        }

        // Remove table if there are no results (e.g. privacy mode enabled)
        if (jQuery.isEmptyObject(data.top_sources_blocked)) {
            $("#client-frequency-blocked").parent().remove();
        }

        $("#client-frequency .overlay").hide();
        $("#client-frequency-blocked .overlay").hide();
        // Update top clients list data every ten seconds
        setTimeout(updateTopClientsChart, 10000);
    });
}

function updateTopLists() {
    $.getJSON("api.php?summaryRaw&topItems", function (data) {

        if ("FTLnotrunning" in data) {
            return;
        }

        // Clear tables before filling them with data
        $("#domain-frequency td").parent().remove();
        $("#ad-frequency td").parent().remove();
        var domaintable = $("#domain-frequency").find("tbody:last");
        var adtable = $("#ad-frequency").find("tbody:last");
        var url, domain, percentage;
        for (domain in data.top_queries) {
            if ({}.hasOwnProperty.call(data.top_queries, domain)) {
                // Sanitize domain
                if (escapeHtml(domain) !== domain) {
                    // Make a copy with the escaped index if necessary
                    data.top_queries[escapeHtml(domain)] = data.top_queries[domain];
                }
                domain = escapeHtml(domain);
                url = "<a href=\"queries.php?domain=" + domain + "\">" + domain + "</a>";
                percentage = data.top_queries[domain] / data.dns_queries_today * 100;
                domaintable.append("<tr> <td>" + url +
                    "</td> <td>" + data.top_queries[domain] + "</td> <td> <div class=\"progress progress-sm\" title=\"" + percentage.toFixed(1) + "% of " + data.dns_queries_today + "\"> <div class=\"progress-bar progress-bar-green\" style=\"width: " +
                    percentage + "%\"></div> </div> </td> </tr> ");
            }
        }

        // Remove table if there are no results (e.g. privacy mode enabled)
        if (jQuery.isEmptyObject(data.top_queries)) {
            $("#domain-frequency").parent().remove();
        }

        for (domain in data.top_ads) {
            if ({}.hasOwnProperty.call(data.top_ads, domain)) {
                // Sanitize domain
                if (escapeHtml(domain) !== domain) {
                    // Make a copy with the escaped index if necessary
                    data.top_ads[escapeHtml(domain)] = data.top_ads[domain];
                }
                domain = escapeHtml(domain);
                url = "<a href=\"queries.php?domain=" + domain + "\">" + domain + "</a>";
                percentage = data.top_ads[domain] / data.ads_blocked_today * 100;
                adtable.append("<tr> <td>" + url +
                    "</td> <td>" + data.top_ads[domain] + "</td> <td> <div class=\"progress progress-sm\" title=\"" + percentage.toFixed(1) + "% of " + data.ads_blocked_today + "\"> <div class=\"progress-bar progress-bar-yellow\" style=\"width: " +
                    percentage + "%\"></div> </div> </td> </tr> ");
            }
        }

        // Remove table if there are no results (e.g. privacy mode enabled)
        if (jQuery.isEmptyObject(data.top_ads)) {
            $("#ad-frequency").parent().remove();
        }

        $("#domain-frequency .overlay").hide();
        $("#ad-frequency .overlay").hide();
        // Update top lists data every 10 seconds
        setTimeout(updateTopLists, 10000);
    });
}

var FTLoffline = false;
function updateSummaryData(runOnce) {
    var setTimer = function (timeInSeconds) {
        if (!runOnce) {
            setTimeout(updateSummaryData, timeInSeconds * 1000);
        }
    };
    $.getJSON("api.php?summary", function LoadSummaryData(data) {

        updateSessionTimer();

        if ("FTLnotrunning" in data) {
            data["dns_queries_today"] = "Lost";
            data["ads_blocked_today"] = "connection";
            data["ads_percentage_today"] = "to";
            data["domains_being_blocked"] = "API";
            // Adjust text
            $("#temperature").html("<i class=\"fa fa-circle\" style=\"color:#FF0000\"></i> FTL offline");
            // Show spinner
            $("#queries-over-time .overlay").show();
            $("#forward-destinations .overlay").show();
            $("#query-types .overlay").show();
            $("#client-frequency .overlay").show();
            $("#domain-frequency .overlay").show();
            $("#ad-frequency .overlay").show();

            FTLoffline = true;
        }
        else if (FTLoffline) {
            // FTL was previously offline
            FTLoffline = false;
            $("#temperature").text(" ");
            updateQueriesOverTime();
            updateTopClientsChart();
            updateTopLists();
        }

        ["ads_blocked_today", "dns_queries_today", "ads_percentage_today", "unique_clients"].forEach(function (today) {
            var todayElement = $("span#" + today);
            todayElement.text() !== data[today] &&
                todayElement.text() !== data[today] + "%" &&
                $("span#" + today).addClass("glow");
        });

        if (data.hasOwnProperty("dns_queries_all_types")) {
            $("#total_queries").prop("title", "only A + AAAA queries (" + data["dns_queries_all_types"] + " in total)");
        }

        window.setTimeout(function () {
            ["ads_blocked_today", "dns_queries_today", "domains_being_blocked", "ads_percentage_today", "unique_clients"].forEach(function (header, idx) {
                var textData = (idx === 3 && data[header] !== "to") ? data[header] + "%" : data[header];
                $("span#" + header).text(textData);
            });
            $("span.glow").removeClass("glow");
        }, 500);

    }).done(function () {
        if (!FTLoffline) {
            setTimer(1);
        }
        else {
            setTimer(10);
        }
    }).fail(function () {
        setTimer(300);
    });
}

$(document).ready(function () {

    var isMobile = {
        Windows: function () {
            return /IEMobile/i.test(navigator.userAgent);
        },
        Android: function () {
            return /Android/i.test(navigator.userAgent);
        },
        BlackBerry: function () {
            return /BlackBerry/i.test(navigator.userAgent);
        },
        iOS: function () {
            return /iPhone|iPad|iPod/i.test(navigator.userAgent);
        },
        any: function () {
            return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Windows());
        }
    };

    // Pull in data via AJAX

    updateSummaryData();

    var ctx = document.getElementById("queryOverTimeChart").getContext("2d");
    timeLineChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [
                {
                    label: "Total",
                    fill: false,
                    backgroundColor: "transparent",
                    borderColor: "rgba(25, 138, 78, 1)",
                    pointBorderColor: "rgba(25, 138, 78, 1)",
                    pointRadius: 1,
                    pointHoverRadius: 5,
                    data: [],
                    pointHitRadius: 5,
                    cubicInterpolationMode: "monotone"
                },
                {
                    label: "Blocked",
                    fill: false,
                    backgroundColor: "transparent",
                    borderColor: "rgba(46,165,187,1)",
                    pointBorderColor: "rgba(46,165,187,1)",
                    pointRadius: 1,
                    pointHoverRadius: 5,
                    data: [],
                    pointHitRadius: 5,
                    cubicInterpolationMode: "monotone"
                }
            ]
        },
        options: {
            tooltips: {
                enabled: true,
                mode: "x-axis",
                callbacks: {
                    title: function (tooltipItem, data) {
                        var label = tooltipItem[0].xLabel;
                        var time = label.match(/(\d?\d):?(\d?\d?)/);
                        var h = parseInt(time[1], 10);
                        var m = parseInt(time[2], 10) || 0;
                        var from = padNumber(h) + ":" + padNumber(m - 5) + ":00";
                        var to = padNumber(h) + ":" + padNumber(m + 4) + ":59";
                        return "Upstreams from " + from + " to " + to;
                    },
                    label: function (tooltipItems, data) {
                        if (tooltipItems.datasetIndex === 1) {
                            var percentage = 0.0;
                            var total = parseInt(data.datasets[0].data[tooltipItems.index]);
                            var blocked = parseInt(data.datasets[1].data[tooltipItems.index]);
                            if (total > 0) {
                                percentage = 100.0 * blocked / total;
                            }
                            return data.datasets[tooltipItems.datasetIndex].label + ": " + tooltipItems.yLabel + " (" + percentage.toFixed(1) + "%)";
                        }
                        else {
                            return data.datasets[tooltipItems.datasetIndex].label + ": " + tooltipItems.yLabel;
                        }
                    }
                }
            },
            legend: {
                display: false
            },
            scales: {
                xAxes: [{
			gridLines:{display:true,color:"#414141"},
                    type: "time",
                    time: {
                        unit: "hour",
                        displayFormats: {
                            hour: "HH:mm"
                        },
                        tooltipFormat: "HH:mm"
                    }
                }],
                yAxes: [{
		    gridLines:{display:true,color:"#414141"},
                    ticks: {
                        beginAtZero: true
                    }
                }]
            },
            maintainAspectRatio: false
        }
    });

    // Pull in data via AJAX

    updateQueriesOverTime();

    // Create / load "Forward Destinations over Time" only if authorized
    if (document.getElementById("forwardDestinationChart")) {
        ctx = document.getElementById("forwardDestinationChart").getContext("2d");
        forwardDestinationChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{ data: [] }]
            },
            options: {
                tooltips: {
                    enabled: true,
                    mode: "x-axis",
                    callbacks: {
                        title: function (tooltipItem, data) {
                            var label = tooltipItem[0].xLabel;
                            var time = label.match(/(\d?\d):?(\d?\d?)/);
                            var h = parseInt(time[1], 10);
                            var m = parseInt(time[2], 10) || 0;
                            var from = padNumber(h) + ":" + padNumber(m - 5) + ":00";
                            var to = padNumber(h) + ":" + padNumber(m + 4) + ":59";
                            return "Forward destinations from " + from + " to " + to;
                        },
                        label: function (tooltipItems, data) {
                            return data.datasets[tooltipItems.datasetIndex].label + ": " + (100.0 * tooltipItems.yLabel).toFixed(1) + "%";
                        }
                    }
                },
                legend: {
                    display: false
                },
                scales: {
                    xAxes: [{
                        type: "time",
                        time: {
                            unit: "hour",
                            displayFormats: {
                                hour: "HH:mm"
                            },
                            tooltipFormat: "HH:mm"
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            mix: 0.0,
                            max: 1.0,
                            beginAtZero: true,
                            callback: function (value, index, values) {
                                return Math.round(value * 100) + " %";
                            }
                        },
                        stacked: true
                    }]
                },
                maintainAspectRatio: true
            }
        });

        // Pull in data via AJAX
        updateForwardedOverTime();
    }

    // Create / load "Top Clients over Time" only if authorized
    if (document.getElementById("clientsChart")) {
        ctx = document.getElementById("clientsChart").getContext("2d");
        clientsChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [{ data: [] }]
            },
            options: {
                tooltips: {
                    enabled: false,
                    mode: "x-axis",
                    custom: customTooltips,
                    itemSort: function (a, b) {
                        return b.yLabel - a.yLabel;
                    },
                    callbacks: {
                        title: function (tooltipItem, data) {
                            var label = tooltipItem[0].xLabel;
                            var time = label.match(/(\d?\d):?(\d?\d?)/);
                            var h = parseInt(time[1], 10);
                            var m = parseInt(time[2], 10) || 0;
                            var from = padNumber(h) + ":" + padNumber(m - 5) + ":00";
                            var to = padNumber(h) + ":" + padNumber(m + 4) + ":59";
                            return "Client activity from " + from + " to " + to;
                        },
                        label: function (tooltipItems, data) {
                            return data.datasets[tooltipItems.datasetIndex].label + ": " + tooltipItems.yLabel;
                        },
                        labelColor: function (tooltipItem, data) {
                            var color = data.tooltip._data.datasets[tooltipItem.datasetIndex].borderColor;
                            return {
                                borderColor: "transparent",
                                backgroundColor: color
                            };
                        }
                    }
                },
                legend: {
                    display: false
                },
                scales: {
                    xAxes: [{
                        gridLines:{display:true,color:"#414141"},
			type: "time",
                        time: {
                            unit: "hour",
                            displayFormats: {
                                hour: "HH:mm"
                            },
                            tooltipFormat: "HH:mm"
                        }
                    }],
                    yAxes: [{
			gridLines:{display:true,color:"#414141"},
                        ticks: {
                            beginAtZero: true
                        },
                        stacked: false
                    }]
                },
                maintainAspectRatio: true
            }
        });

        // Pull in data via AJAX
        updateClientsOverTime();
    }

    // Create / load "Query Types over Time" only if authorized
    if (document.getElementById("queryTypeChart")) {
        ctx = document.getElementById("queryTypeChart").getContext("2d");
        queryTypeChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: [],
                datasets: [
                    {
                        label: "A: IPv4 queries",
                        pointRadius: 0,
                        pointHitRadius: 5,
                        pointHoverRadius: 5,
                        data: [],
                        cubicInterpolationMode: "monotone"
                    },
                    {
                        label: "AAAA: IPv6 queries",
                        pointRadius: 0,
                        pointHitRadius: 5,
                        pointHoverRadius: 5,
                        data: [],
                        cubicInterpolationMode: "monotone"
                    }
                ]
            },
            options: {
                tooltips: {
                    enabled: true,
                    mode: "x-axis",
                    callbacks: {
                        title: function (tooltipItem, data) {
                            var label = tooltipItem[0].xLabel;
                            var time = label.match(/(\d?\d):?(\d?\d?)/);
                            var h = parseInt(time[1], 10);
                            var m = parseInt(time[2], 10) || 0;
                            var from = padNumber(h) + ":" + padNumber(m - 5) + ":00";
                            var to = padNumber(h) + ":" + padNumber(m + 4) + ":59";
                            return "Query types from " + from + " to " + to;
                        },
                        label: function (tooltipItems, data) {
                            return data.datasets[tooltipItems.datasetIndex].label + ": " + (100.0 * tooltipItems.yLabel).toFixed(1) + "%";
                        }
                    }
                },
                legend: {
                    display: false
                },
                scales: {
                    xAxes: [{
                        type: "time",
                        time: {
                            unit: "hour",
                            displayFormats: {
                                hour: "HH:mm"
                            },
                            tooltipFormat: "HH:mm"
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            mix: 0.0,
                            max: 1.0,
                            beginAtZero: true,
                            callback: function (value, index, values) {
                                return Math.round(value * 100) + " %";
                            }
                        },
                        stacked: true
                    }]
                },
                maintainAspectRatio: true
            }
        });

        // Pull in data via AJAX
        updateQueryTypesOverTime();
    }

    // Create / load "Top Domains" and "Top Advertisers" only if authorized
    if (document.getElementById("domain-frequency")
        && document.getElementById("ad-frequency")) {
        updateTopLists();
    }

    // Create / load "Top Clients" only if authorized
    if (document.getElementById("client-frequency")) {
        updateTopClientsChart();
    }

    $("#queryOverTimeChart").click(function (evt) {
        var activePoints = timeLineChart.getElementAtEvent(evt);
        if (activePoints.length > 0) {
            //get the internal index of slice in pie chart
            var clickedElementindex = activePoints[0]["_index"];

            //get specific label by index
            var label = timeLineChart.data.labels[clickedElementindex];

            //get value by index
            var from = label / 1000 - 300;
            var until = label / 1000 + 300;
            window.location.href = "queries.php?from=" + from + "&until=" + until;
        }
        return false;
    });

    if (document.getElementById("queryTypePieChart")) {
        ctx = document.getElementById("queryTypePieChart").getContext("2d");
        queryTypePieChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [{ data: [] }]
            },
            options: {
                legend: {
                    display: false
                },
                tooltips: {
                    enabled: false,
                    custom: customTooltips,
                    callbacks: {
                        title: function (tooltipItem, data) {
                            return "Query types";
                        },
                        label: function (tooltipItems, data) {
                            var dataset = data.datasets[tooltipItems.datasetIndex];
                            var label = dataset.label;
                            return label + ": " + dataset.data[tooltipItems.index].toFixed(1) + "%";
                        }
                    }
                },
                animation: {
                    duration: 750
                },
                cutoutPercentage: 0,
                scales:{
                    xAxes:[{stacked:true}],
                    yAxes:[{stacked:true,
                        gridLines:{display:true,color:"#414141"},
                        ticks:{min: 0, max: 100, stepSize: 25}
                    }]
                }
            }
        });

        // Pull in data via AJAX
        updateQueryTypesPie();
    }

    if (document.getElementById("forwardDestinationPieChart")) {
        ctx = document.getElementById("forwardDestinationPieChart").getContext("2d");
        forwardDestinationPieChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [],
                datasets: [{ data: [] }]
            },
            options: {
                legend: {
			        display:false
                },
                tooltips: {
                    enabled: false,
                    custom: customTooltips,
                    callbacks: {
                        title: function (tooltipItem, data) {
                            return "Forward destinations";
                        },
                        label: function (tooltipItems, data) {
                            var dataset = data.datasets[tooltipItems.datasetIndex];
                            var label = dataset.label;
                            return label + ": " + dataset.data[tooltipItems.index].toFixed(1) + "%";
                        }
                    }
                },
                animation: {
                    duration: 750
                },
                cutoutPercentage: 0,
                scales:{
                    xAxes:[{stacked:true}],
                    yAxes:[{stacked:true,
                        gridLines:{display:true,color:"#414141"},
                        ticks:{min: 0, max: 100, stepSize: 25}
                    }]
                }
            }
        });

        // Pull in data via AJAX
        updateForwardDestinationsPie();
    }
});
