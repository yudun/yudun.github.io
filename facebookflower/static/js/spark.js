$("#status").text("Rendering Spark vis...")
d3.select('body').append('svg').attr("id", "sparksvg").style('display', 'none')

var yearlist
var data
var maxrecentintimacy,
    maxallintimacy,
    maxratio,
    maxlength,
    maxtyperatio;

//Make sure the data processing is after the data transmission
$.ajaxSetup({
    async: false
});

$.getJSON(URL_PREFIX + "data/" + username_id + "/" + username_id + "_result.json", function(response) {
    yearlist = response.yearlist
    data = response.data
    maxrecentintimacy = response.maxrecentintimacy
    maxallintimacy = response.maxallintimacy
    maxratio = response.maxratio
    maxlength = response.maxlength
    maxtyperatio = response.maxtyperatio
})

////////////////////////  CONSTANT ////////////////////
//Define the margin
var margin = {
    top: 0 / 1366 * screen.availWidth,
    right: 10 / 1366 * screen.availWidth,
    bottom: 30 / 1366 * screen.availWidth,
    left: 450 / 1366 * screen.availWidth
};
var width = screen.availWidth - margin.left - margin.right,
    height = $(window).height() - margin.top - margin.bottom - $("#mainviewtitle").outerHeight();
var svgflowerdiameter = height,
    svgflowerleftmargin = margin.left + width / 2 - (height / 2 * .8)

var legendFont = "Verdana"

var heartradius = 0.04 * height

var MAXlength = height / 2 - heartradius,
    MAXthickness = 15,
    MAXlightess = 0.55,
    MAXinnersizeratio = 0.6;

var backgroundBorder = MAXthickness + 10

var alpha = Math.PI * (30 / 180),
    beta = Math.PI * (45 / 180)

var STEPNUM = 200

var spiralInterval = 2.0
var spiralStepPerCircumference = 100
var maxSpiralStep = spiralStepPerCircumference * Math.ceil(MAXthickness * 4 / spiralInterval)
var extraDetectionAngle = 20
// Mapping function
var len = d3.scale.pow().exponent(0.5)
    .domain([0, maxlength])
    .range([MAXthickness * 2, MAXlength]);

var thick = d3.scale.pow().exponent(0.4)
    .domain([0, maxallintimacy])
    .range([2, MAXthickness]);

var lightrange = [.35, .40, .45, .55]
var prelight = d3.scale.pow().exponent(0.1)
    .domain([0, maxrecentintimacy])
    .range([0, MAXlightess]);
var light = d3.scale.quantize()
    .domain([0, MAXlightess])
    .range([lightrange[0], lightrange[1], lightrange[2], lightrange[3]]);
var colorindex = d3.scale.quantize()
    .domain([0, MAXlightess])
    .range(["0", "1", "2", "3"]);

var stepscale = d3.scale.linear()
    .domain([0, maxlength])
    .range([50, 200]);

var innersize = d3.scale.quantize()
    .domain([0, maxtyperatio])
    .range([0.3 * MAXinnersizeratio, 0.6 * MAXinnersizeratio, MAXinnersizeratio]);

var stamenbrightRatio = 1.3

var colorlist = {
    "msg": [337, .61, "message frequently", "msg"],
    "like": [58, 1, "like frequently", "like"],
    "cmt": [82, .87, "comment frequently", "cmt"],
    "else": [191, .79, "other frequently", "else"],
    "stranger": [0, 0, "stranger", "stranger"]
}

var svg = d3.select("#sparksvg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

//filter
var filter = svg.append("defs")
//blur
// filter.append("filter")
//     .attr("id", "blur")
//     .attr("height", "2")
//     .append("feGaussianBlur")
//     .attr("in", "SourceGraphic")
//     .attr("stdDeviation", 1)
//     .attr("result", "blur");
//shadow
var shadow = filter.append("filter")
    .attr("id", "dropShadow");
shadow.append("feGaussianBlur")
    .attr("in", "SourceAlpha")
    .attr("stdDeviation", 3);
shadow.append("feOffset").attr("dx", 4).attr("dy", 4);
var t = shadow.append("feMerge");
t.append('feMergeNode');
t.append("feMergeNode").attr("in", "SourceGraphic");

////////// Overlapping reduction using Spiral Detection ///////////
var dis = function(x, y) {
    return Math.sqrt(x * x + y * y)
}
var angle = function(x, y) {
    var t;
    if (Math.abs(x) <= 0.0001) {
        if (y > 0) t = 90
        else t = 270
    } else {
        t = Math.atan(y / x) / Math.PI * 180
        if (x < 0) t = 180 + t
        else if (t < 0) t = 360 + t
    }
    return 360 - t
}
var spiralRadiusDelta = spiralInterval / spiralStepPerCircumference
var spiralAngleDelta = 2 * Math.PI / spiralStepPerCircumference

Array.prototype.insert = function(index, item) {
    this.splice(index, 0, item);
};

// angle List is a list classify all the nodes according to their rounded up angle
var angleList = []
for (var i = 0; i < 360; i++) {
    angleList.push([])
}

/////////////////////////// Begin rearranging points ///////////////////
var perfectcount = 0; // the number of perfect non-overlapping points
for (var i = 0; i < data.length; i++) {
    var l = len(data[i]["length"]) + heartradius
    var tx = l * Math.cos(-Math.PI * data[i]["approvedangle"] / 180)
    var ty = l * Math.sin(-Math.PI * data[i]["approvedangle"] / 180)
    var r = thick(data[i]["allIntimacy"])
    var result = spiralDetect(tx, ty, r, data[i]["type"])

    var x = result.x
    var y = result.y
    var newangle = angle(x, y)
    var newlength = dis(x, y)
    var newpoint = {
        "x": x,
        "y": y,
        "len": newlength,
        "r": r,
        "type": data[i]["type"],
        "year": data[i]["year"]
    }
    var angleindex = Math.round(newangle) % 360
    var templ = angleList[angleindex]
    var j;

    //nodes inserted by their length within each degree
    for (j = 0; j < templ.length; j++) {
        if (newpoint.len < templ[j].len)
            break
    }
    templ.insert(j, newpoint)

    data[i]["length"] = newlength
    data[i]["approvedangle"] = newangle
}

function spiralDetect(x, y, r, type) {
    var maxmin = 0
    var resultx = x,
        resulty = y
    var testx, testy
    var stepa = 0
    var stepr = 0
    var maxX = MAXlength + heartradius + margin.top - r
    var minX = -(MAXlength + heartradius + margin.bottom - r)
    for (var i = 0; i < maxSpiralStep; i++) {
        testx = x + stepr * Math.cos(stepa)
        testy = y + stepr * Math.sin(stepa)
        //avoid the bottomest node exceed the margin
        if (testx > maxX || testx < minX)
            break
        var temp = detect(testx, testy, r, type)
        if (temp.success) {
            resultx = testx
            resulty = testy
            perfectcount++;
            break
        } else if (maxmin < temp.min) {
            maxmin = temp.min
            resultx = testx
            resulty = testy
        }
        //find next point on the spiral
        stepr += spiralRadiusDelta
        stepa += spiralAngleDelta
    }
    return {
        "x": resultx,
        "y": resulty
    }
    // return {"x":x,"y":y}
}

// console.log(perfectcount+"/"+data.length)

function dis2(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
}

function detect(x, y, r, type) {
    var success = true
    var min = 10000
    var a = angle(x, y)
    var l = dis(x, y)
    var threhold = r + MAXthickness
    var minl = l - threhold,
        maxl = l + threhold
    var da;
    if (threhold >= l) da = 90
    else da = Math.ceil(Math.asin(threhold / l)) + extraDetectionAngle
    if (da > 90) da = 90

    var notStranger = (type != "stranger")

    for (var i = (Math.round(a) - da + 360) % 360, count = 1; count <= 2 * da; i++, count++) {
        var index = i % 360
        var current = angleList[index]
        for (var j = 0; j < current.length; j++) {
            if (current[j].len < minl) continue
            if (current[j].len > maxl) break
            // nonStranger can overlap strangers
            // if(notStranger && current[j].type == "stranger") continue
            var d = dis2(current[j].x, current[j].y, x, y)
            if (d < current[j].r + r) success = false
            if (d < min) min = d
        }
    }

    return {
        "min": min,
        "success": success
    };
}

///////////////////////////// ReSort all in long --> short order
data.sort(function(a, b) {
    return b.length - a.length;
})
var yearindexlist = {}
for (var i = 0; i < yearlist.length; i++) {
    yearindexlist[yearlist[i].year] = []
};
for (var i = 0; i < data.length; i++) {
    yearindexlist[data[i].year].push(i)
};

/////////////////// Begin Rendering ////////////////////
var colordata = $.map(colorlist, function(value, index) {
    return [value];
});
//The Main Legent
var legend = svg.append("g")
    .attr("transform", "translate(" + 130 + "," + height * 3 / 5 + ")");

legend.selectAll(".legendtext").data(colordata).enter()
    .append("text")
    .attr("class", "legendtext")
    .attr("x", "25px")
    .attr("font-family", legendFont)
    .attr("y", function(d, i) {
        return i * 40 - 4
    })
    .attr("font-size", 15)
    .attr("fill", "black")
    .text(function(d) {
        return d[2]
    });

colordata.splice(colordata.length - 1, 1);
for (var i = 0; i < lightrange.length; i++) {
    legend.selectAll().data(colordata).enter()
        .append("rect")
        .attr("class", function(d) {
            var url = d[3] + (lightrange.length - 1 - i)
            return "legend " + url
        })
        .attr("x", 20 + 50 * i + "px")
        .attr("y", function(d, i) {
            return i * 40
        })
        .attr("width", 50)
        .attr("height", 20)
        .attr("fill", function(d) {
            return d3.hsl(d[0], d[1], lightrange[lightrange.length - 1 - i])
        })
        .attr("stroke", "white")
}
legend.append("rect")
    .attr("class", "legend stranger")
    .attr("x", 20)
    .attr("y", lightrange.length * 40)
    .attr("width", 50 * lightrange.length)
    .attr("height", 20)
    .attr("fill", "white")
    .attr("stroke", "gray")

//year legend
var yearlegend = svg.append("g").attr("class", "yearlegend")
    .attr("transform", "translate(" + 120 / 1366 * screen.availWidth + "," + (10 + (6 - (yearlist.length + 1) / 2) / 2 * 30) / 1366 * screen.availWidth + ")")
var yearlistFirst6 = yearlist.slice(0, (yearlist.length + 1) / 2)
var yearlistLast5 = yearlist.slice((yearlist.length + 1) / 2, yearlist.length)

for (var i = 0; i < yearlistFirst6.length; i++) {
    var id;
    id = "flowerrec_" + yearlistFirst6[i].year
    yearlegend.append("rect")
        .attr("class", "floweryear")
        .attr("id", id)
        .attr("x", -5)
        .attr("y", 30 * i + 10)
        .attr("width", 125)
        .attr("height", 22)
        .attr("fill", "white")
        .attr("stroke", "gray")
        .attr("stroke-width", .5)
        .style('filter', 'url(#dropShadow)')
};
for (var i = 0; i < yearlistLast5.length + 1; i++) {
    var id;
    if (i == yearlistLast5.length) id = "flowerrec_all"
    else id = "flowerrec_" + yearlistLast5[i].year
    yearlegend.append("rect")
        .attr("class", "floweryear")
        .attr("id", id)
        .attr("x", i == yearlistLast5.length ? 150 - 1 : 150 - 5)
        .attr("y", 30 * i + 10)
        .attr("width", 125)
        .attr("height", 22)
        .attr("fill", "white")
        .attr("stroke", "gray")
        .attr("stroke-width", .5)
        .style('filter', i == yearlistLast5.length ? '' : 'url(#dropShadow)')
};

yearlegend.selectAll().data(yearlistFirst6)
    .enter().append("text")
    .attr("class", "floweryear")
    .attr("id", function(d) {
        return "flower" + d.year
    })
    .attr("x", 30)
    .attr("font-family", legendFont)
    .attr("y", function(d, i) {
        return 30 * (i + 1)
    })
    .attr("font-size", 20)
    .attr("fill", "black")
    .style('cursor', 'default')
    .text(function(d) {
        return d.year;
    })

yearlegend.selectAll().data(yearlistLast5)
    .enter().append("text")
    .attr("class", "floweryear")
    .attr("id", function(d) {
        return "flower" + d.year
    })
    .attr("x", 150 + 30)
    .attr("font-family", legendFont)
    .attr("y", function(d, i) {
        return 30 * (i + 1)
    })
    .attr("font-size", 20)
    .attr("fill", "black")
    .style('cursor', 'default')
    .text(function(d) {
        return d.year;
    })
yearlegend.append("text")
    .attr("class", "floweryear")
    .attr("id", "flowerall")
    .attr("x", 150 + 6)
    .attr("font-family", legendFont)
    .attr("y", 30 * (yearlistLast5.length + 1))
    .attr("font-size", 20)
    .attr("fill", "lightgray")
    .style('cursor', 'default')
    .text("SHOW ALL")


// The Main body -- flower
var flower = svg
    .append("g")
    .attr('id', "main_sparksvg")
    .attr("transform", "translate(" + (margin.left + width / 2) + "," + (margin.top + height / 2) + ")")

//Define all the gradient
var gradient = flower.append("defs")
var t = gradient.append("svg:linearGradient")
    .attr("id", "stranger")
    .attr("x1", "0%")
    .attr("x2", "100%");
t.append("svg:stop")
    .attr("offset", "0%")
    .attr("stop-color", "white")
    .attr("stop-opacity", .8);
t.append("svg:stop")
    .attr("offset", "100%")
    .attr("stop-color", "white")
    .attr("stop-opacity", .8)

for (var i = 0; i < lightrange.length; i++) {
    var t =
        gradient.selectAll(".gradient")
            .data(colordata)
            .enter()
            .append("svg:linearGradient")
            .attr("id", function(d) {
                return d[3] + i
            })
            .attr("x1", "0%")
            .attr("x2", "100%");

    t.append("svg:stop")
        .attr("offset", "0%")
        .attr("stop-color", "white")
        .attr("stop-opacity", .8)

    t.append("svg:stop")
        .attr("offset", "100%")
        .attr("stop-color", function(d) {
            return d3.hsl(colorlist[d[3]][0], colorlist[d[3]][1], lightrange[i])
        })
        .attr("stop-opacity", .8)
}

// store all the points for each petal, which will be used again in up_petal and hidden_petal
var petalPointList = new Array(data.length)
// Draw all the petals
var petal = flower.append("g")
    .attr("class", "flowerbody")
    .selectAll(".petal")
    .data(data).enter().append("g")
    .attr("class", function(d, i) {
        var url
        if (d.type == "stranger") url = "stranger"
        else url = d.type + colorindex(prelight(d.recentIntimacy))
        return "petal " + url
    })
    .attr("id", function(d, i) {
        return "petal" + i
    })
    .attr("transform", function(d) {
        return "rotate(" + (d.approvedangle - 90) + ",0,0)"
    })
petal.append("polygon")
    .attr("class", "petalbody petal")
    .attr("id", function(d, i) {
        return "petalbody" + i
    })
    .attr("points", function(d, i) {
        var pouter = generatePetal(d.ratio, d.clockwise, d.length, d.allIntimacy, 0)
        var pinner = generatePetal(d.ratio, d.clockwise, d.length, d.allIntimacy, 1)
        petalPointList[i] = [
            [heartradius, 0]
        ].concat(pouter).concat(pinner.reverse())
        return petalPointList[i]
    })
    .attr("fill", function(d, i) {
        var url
        if (d.type == "stranger") url = "stranger"
        else url = d.type + colorindex(prelight(d.recentIntimacy))
        return "url(#" + url + ")"
    })
    .attr("stroke-width", 0.5)
    .attr("stroke", function(d) {
        if (d.type == "stranger")
            return "gray"
        else
            return "white"
    })

var stamencolor = function(d) {
    var l = light(prelight(d.recentIntimacy))
    if (d.type == "stranger") return "white"
    else return d3.hsl(colorlist[d.type][0], colorlist[d.type][1], l * stamenbrightRatio)
}
var innerstamencolor = function(d) {
    var l = light(prelight(d.recentIntimacy))
    if (d.secondtype == "stranger") return "white"
    else return d3.hsl(colorlist[d.secondtype][0], colorlist[d.secondtype][1], l * stamenbrightRatio)
}
petal.append("circle")
    .attr("class", "stamen petal")
    .attr("id", function(d, i) {
        return "stamen" + i
    })
    .attr("cx", function(d) {
        return d.length
    })
    .attr("fill", stamencolor)
    .attr("stroke", "#dfdfdf")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("r", function(d) {
        return thick(d.allIntimacy)
    })
petal.append("circle")
    .attr("class", "innerstamen petal")
    .attr("class", function(d, i) {
        var url
        if (d.secondtype == "stranger") url = "stranger"
        else url = d.secondtype + colorindex(prelight(d.recentIntimacy))
        return "innerstamen petal " + url
    })
    .attr("id", function(d, i) {
        return "innerstamen" + i
    })
    .attr("cx", function(d) {
        return d.length
    })
    .attr("fill", innerstamencolor)
    .attr("opacity", 1)
    .attr("r", function(d) {
        if (d.secondtype == "stranger") return thick(d.allIntimacy) / 3
        return thick(d.allIntimacy) * innersize(d.typeratio)
    })

//hidden background
flower.append("g").attr("class", "hidden_background")
    .style("visibility", "hidden")
    .append("rect")
    .attr('x', -width / 2)
    .attr('y', -margin.top - height / 2)
    .attr("width", width + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .attr("fill", "white")
    .attr("opacity", 0.9)

///////////////// The up_petal showed up when coressponding year is chosen
var up_petal = flower.append("g")
    .attr("class", "up_flowerbody")
    .selectAll(".up_petal")
    .data(data).enter().append("g")
    .attr("class", function(d, i) {
        var url
        if (d.type == "stranger") url = "stranger"
        else url = d.type + colorindex(prelight(d.recentIntimacy))
        return "up_petal " + url
    })
    .attr("id", function(d, i) {
        return "up_petal" + i
    })
    .attr("transform", function(d) {
        return "rotate(" + (d.approvedangle - 90) + ",0,0)"
    })
    .style("visibility", "hidden")
up_petal.append("polygon")
    .attr("class", "up_petalbody up_petal")
    .attr("id", function(d, i) {
        return "up_petalbody" + i
    })
    .attr("points", function(d, i) {
        return petalPointList[i]
    })
    .attr("fill", function(d, i) {
        var url
        if (d.type == "stranger") url = "stranger"
        else url = d.type + colorindex(prelight(d.recentIntimacy))
        return "url(#" + url + ")"
    })
    .attr("stroke-width", 0.5)
    .attr("stroke", function(d) {
        if (d.type == "stranger")
            return "gray"
        else
            return "white"
    })
up_petal.append("circle")
    .attr("class", "up_stamen up_petal")
    .attr("id", function(d, i) {
        return "up_stamen" + i
    })
    .attr("cx", function(d) {
        return d.length
    })
    .attr("fill", stamencolor)
    .attr("stroke", "#dfdfdf")
    .attr("stroke-width", 1)
    .attr("opacity", 1)
    .attr("r", function(d) {
        return thick(d.allIntimacy)
    })
up_petal.append("circle")
    .attr("class", "up_innerstamen up_petal")
    .attr("class", function(d, i) {
        var url
        if (d.secondtype == "stranger") url = "stranger"
        else url = d.secondtype + colorindex(prelight(d.recentIntimacy))
        return "up_innerstamen up_petal " + url
    })
    .attr("id", function(d, i) {
        return "up_innerstamen" + i
    })
    .attr("cx", function(d) {
        return d.length
    })
    .attr("fill", innerstamencolor)
    .attr("opacity", 1)
    .attr("r", function(d) {
        if (d.secondtype == "stranger") return thick(d.allIntimacy) / 3
        return thick(d.allIntimacy) * innersize(d.typeratio)
    })

//////////////////////// hidden peatal is showed up when hovered
//////////////////////// All the hidden petal
var hidden_petal = flower.append("g")
    .attr("class", "hidden_flowerbody")
    .selectAll(".hidden_petal")
    .data(data).enter().append("g")
    .attr("class", function(d, i) {
        var url
        if (d.type == "stranger") url = "stranger"
        else url = d.type + colorindex(prelight(d.recentIntimacy))
        return "hidden_petal " + url
    })
    .attr("id", function(d, i) {
        return "hidden_petal" + i
    })
    .attr("transform", function(d) {
        return "rotate(" + (d.approvedangle - 90) + ",0,0)"
    })
    .style("visibility", "hidden")

hidden_petal.append("polygon")
    .attr("class", "hidden_petalbody hidden_petal")
    .attr("id", function(d, i) {
        return "hidden_petalbody" + i
    })
    .attr("points", function(d, i) {
        return petalPointList[i]
    })
    .attr("fill", function(d) {
        return d3.hsl(colorlist[d.type][0], colorlist[d.type][1], d.type == "stranger" ? 0.8 : MAXlightess)
    })
    .attr("stroke-width", 0.5)
    .attr("stroke", function(d) {
        if (d.type == "stranger")
            return "gray"
        else
            return "white"
    })

hidden_petal.append("circle")
    .attr("class", "hidden_stamen hidden_petal")
    .attr("id", function(d, i) {
        return "hidden_stamen" + i
    })
    .attr("cx", function(d) {
        return d.length
    })
    .attr("fill", "black")
    .attr("stroke", "Gray")
    .attr("opacity", 1)
    .attr("r", function(d) {
        return thick(d.allIntimacy)
    })
hidden_petal.append("circle")
    .attr("class", function(d, i) {
        var url
        if (d.secondtype == "stranger") url = "stranger"
        else url = d.secondtype + colorindex(prelight(d.recentIntimacy))
        return "hidden_innerstamen hidden_petal " + url
    })
    .attr("id", function(d, i) {
        return "hidden_innerstamen" + i
    })
    .attr("cx", function(d) {
        return d.length
    })
    .attr("fill", innerstamencolor)
    .attr("opacity", 1)
    .attr("r", function(d) {
        if (d.secondtype == "stranger") return thick(d.allIntimacy) / 3
        return thick(d.allIntimacy) * innersize(d.typeratio)
    })

//heart of the flower
var heart = flower.append("g").attr("class", "heart")
heart.append("circle").attr("r", heartradius)
    .attr("fill", "white")
heart.append("circle").attr("r", heartradius)
    .attr("fill", "steelblue")
    .attr("opacity", .5);

//month legend
flower.append('g')
    .selectAll('.monthlegend')
    .data(["Feb.", "May", "Aug.", "Nov."]).enter().append('text')
    .attr('class', "monthlegend")
    .attr("font-family", "VTKSFLOWERSINOURSOUL")
    .attr('font-size', 40)
    .attr('fill', "steelblue")
    // .style('filter', 'url(#blur)')
    .attr('x', function(d, i) {
        switch (i) {
            case 0:
            case 1:
                return height / 2 * .8
            case 2:
            case 3:
                return -height / 2 * .8 - 80
        }
    })
    .attr('y', function(d, i) {
        return i == 0 || i == 3 ? 40 - height / 2 * 0.8 : height / 2 * 0.8
    })
    .text(function(d) {
        return d
    })

// //////////////////// LOGO ///////////////////
// var logo = svg.append('a')
//     .attr('xlink:href', 'http://vidi.cs.ucdavis.edu/')
//     .attr('target', "_blank")
//     .append("svg:image")
//     .attr("xlink:href", "res/image/logo.png")
//     .attr("width", 200)
//     .attr("height", 200)
//     .attr("x", 0)
//     .attr("y",-50);

// var logotitle = svg.append("text")
// .attr("x", 200)
// .attr("font-family","VTKSFLOWERSINOURSOUL") 
// .attr("y",  50)
// .attr("font-size", 50)
// .attr("fill", "black")
// .text("FACEBOOK FLOWER");

// // var logotitle = svg.append("text")
// // .attr('id', "yearlegend")
// // .attr("x", 600)
// // .attr("font-family","Verdana") 
// // .attr("y",  50)
// // .attr("font-size", 40)
// // .attr("fill", "black")
// // .text("");

//////////////////// GUIDANCE ///////////////
var guidance = svg.append("g").attr("class", "guidance").attr('id', "spark_guidance")
    .attr('transform', 'translate(' + 170 / 1366 * screen.availWidth + ',' + 0 / 1366 * screen.availWidth + ')')

guidance.append('text')
    .attr('font-family', legendFont)
    .attr('fill', "black")
    .attr('y', 20)
    .attr('x', 8)
    .attr('font-size', 15)
    .attr('font-weight', "bold")
    .style('cursor', 'default')
    .text('HOW TO READ IT?')

guidance.append('rect')
    .attr("class", "btn btn-primary btn-lg guidanceBtn")
    .attr('data-toggle', "modal")
    .attr("data-target", "#sparkguidance")
    .attr("width", 170)
    .attr('height', 30)
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('fill', "white")
    .attr('fill-opacity', .5)
    .attr("stroke", "steelblue")

function generatePetal(ratio, clockwise, length, thickness, mode) {
    var x1 = heartradius,
        y1 = 0,
        x2 = length,
        y2 = 0
    var r = thick(thickness)
    var bx = x2 + r * Math.cos(alpha),
        by = r * Math.sin(alpha);
    if (mode == 1) {
        bx = x2 - r * Math.cos(alpha);
        by = -r * Math.sin(alpha);
    }
    var cp = getControlPoint(x2, r, mode, bx, by, ratio)
    var cx1 = cp[0][0],
        cy1 = cp[0][1],
        cx2 = cp[1][0],
        cy2 = cp[1][1];
    if (clockwise == true) {
        cy1 = -cy1
        cy2 = -cy2
        by = -by
    }
    /* cp = [[cx1,cy2],[cx2,cy2]]
     cp.push([bx,by])
     return cp*/ ////////////////////////
    var p = []
    var step = 1.0 / stepscale(x2)
    for (i = 0; i <= 1; i += step) {
        p.push(getPoint(x1, y1, cx1, cy1, cx2, cy2, bx, by, i))
    }
    return p
}


function getPoint(x0, y0, x1, y1, x2, y2, x3, y3, step) {
    var t = (1 - step);
    var x, y;
    x = step * step * step * x3 + t * (3 * step * step * x2 + t * (3 * step * x1 + t * x0))
    y = step * step * step * y3 + t * (3 * step * step * y2 + t * (3 * step * y1 + t * y0))
    return [x, y]
}

//mode = 0 --> clockwise up || anticlockwise down
function getControlPoint(l, r, mode, bx, by, ratio) {
    if (mode == 0) {
        a = Math.PI - alpha
        var a1, a2;
        var c = Math.sqrt(l * l + r * r - 2 * l * r * Math.cos(a))
        var aa = Math.asin(r / c * Math.sin(a))
        a1 = aa + beta
        a2 = alpha + Math.PI / 2

        var t;
        t = Math.PI / 2 - alpha + aa
        var maxc1 = c * Math.sin(t) / Math.sin(beta + t)
        var maxc2 = c * Math.sin(beta) / Math.sin(beta + t)

        var curva1 = d3.scale.linear()
                .domain([0, maxratio])
                .range([0, maxc1]),
            curva2 = d3.scale.linear()
                .domain([0, maxratio])
                .range([0, maxc2]);
        var l1 = curva1(ratio),
            l2 = curva2(ratio);

        // left control point
        return [
            [l1 * Math.cos(a1), l1 * Math.sin(a1)],
            //right control point
            [bx + l2 * Math.cos(a2), by + l2 * Math.sin(a2)]
        ]
    } else {
        a = alpha
        var a1, a2;
        var c = Math.sqrt(l * l + r * r - 2 * l * r * Math.cos(a))
        var aa = Math.asin(r / c * Math.sin(a))
        a1 = beta - aa
        a2 = alpha + Math.PI / 2

        var t;
        t = Math.PI / 2 - alpha - aa
        var maxc1 = c * Math.sin(t) / Math.sin(beta + t)
        var maxc2 = c * Math.sin(beta) / Math.sin(beta + t)

        var curva1 = d3.scale.linear()
                .domain([0, maxratio])
                .range([0, maxc1]),
            curva2 = d3.scale.linear()
                .domain([0, maxratio])
                .range([0, maxc2]);
        var l1 = curva1(ratio),
            l2 = curva2(ratio);

        // left control point
        return [
            [l1 * Math.cos(a1), l1 * Math.sin(a1)],
            //right control point
            [bx + l2 * Math.cos(a2), by + l2 * Math.sin(a2)]
        ]
    }
}

//////////////////// deal with hover event on petal /////////////
var flower_idnum
$(".petal, .hidden_petal, .up_petal").hover(
    function() {
        flower_idnum = $(this).attr("id").match(/\d+/)[0]
        $("#hidden_petal" + flower_idnum).css("visibility", "visible").css("opacity", 1)
        Tip('<img src=\'https://' + data[flower_idnum].pic + '\' width=\'50\'>',
            TITLE, data[flower_idnum].name)
        // console.log(data[flower_idnum].year)
    },
    function() {
        $("#hidden_petal" + flower_idnum).css("visibility", "hidden");
        UnTip()
    }
);

//////////////////// color palette to adjust color
lightrangeratio = [lightrange[0] / lightrange[3], lightrange[1] / lightrange[3], lightrange[2] / lightrange[3], 1]
$(".legend").each(function() {
    var color = $(this).attr("fill")
    var name = $(this).attr("class").split(" ")[1]
    if (name == "stranger") {
        $(this).colpick({
            color: color,
            onChange: function(hsb, hex, rgb, el) {
                $(el).attr("fill", "#" + hex);
                $("#stranger stop:nth-child(2)").attr("stop-color", "#" + hex)
            }
        });
    } else {
        var index = name.match(/\d+/)[0]
        if (index == 3) {
            $(this).colpick({
                color: color,
                onChange: function(hsb, hex, rgb, el) {
                    var name = $(el).attr("class").split(" ")[1]
                    var type = name.replace(/\d+/g, "");
                    var originalb = hsb.b
                    for (var i = 0; i < 4; i++) {
                        ////// change the label's color
                        hsb.b = originalb * lightrangeratio[i]
                        $(".legend." + type + "" + i).attr("fill", "#" + $.colpick.hsbToHex(hsb))

                        ////// change the non-hidden's color
                        $("#" + type + "" + i + " stop:nth-child(2)").attr("stop-color", "#" + $.colpick.hsbToHex(hsb))
                        hsb.b *= stamenbrightRatio
                        if (hsb.b > 100) hsb.b = 100
                        $(".petal." + type + "" + i + ">.stamen:nth-child(2)").attr("fill", "#" + $.colpick.hsbToHex(hsb))
                        $(".petal." + type + "" + i + ".innerstamen:nth-child(3)").attr("fill", "#" + $.colpick.hsbToHex(hsb))

                        ////// change the up's color
                        hsb.b = originalb * lightrangeratio[i] * stamenbrightRatio
                        if (hsb.b > 100) hsb.b = 100
                        $(".up_petal." + type + "" + i + ">.up_stamen:nth-child(2)").attr("fill", "#" + $.colpick.hsbToHex(hsb))
                        $(".up_petal." + type + "" + i + ".up_innerstamen:nth-child(3)").attr("fill", "#" + $.colpick.hsbToHex(hsb))

                        ///// change the hidden's color
                        hsb.b = 100
                        $(".hidden_petal." + type + "" + i + ">.hidden_petalbody:nth-child(1)")
                            .attr("fill", "#" + $.colpick.hsbToHex(hsb))
                        $(".hidden_petal." + type + "" + i + ".hidden_innerstamen:nth-child(3)")
                            .attr("fill", "#" + $.colpick.hsbToHex(hsb))
                    }
                }
            });
        }
    }
});

///////// select specific year
var selectedyear = "all"
$(".floweryear").click(function() {
    var year = $(this).attr("id").replace("flowerrec_", "").replace("flower", "")
    // if(year!="all"){
    //   $("#yearlegend").text(year)
    // }
    // else  $("#yearlegend").text("")

    if (year != selectedyear) {
        //recover lasted year legend
        $("#flowerrec_" + selectedyear).css("filter", "url(#dropShadow)")
        $("#flowerrec_" + selectedyear).attr("x", parseInt($("#flowerrec_" + selectedyear).attr("x")) - 4)
        $("#flower" + selectedyear).attr("x", parseInt($("#flower" + selectedyear).attr("x")) - 4)
        $("#flower" + selectedyear).attr("fill", "black")
        // push current year legend down
        $("#flowerrec_" + year).css("filter", "")
        $("#flowerrec_" + year).attr("x", parseInt($("#flowerrec_" + year).attr("x")) + 4)
        $("#flower" + year).attr("x", parseInt($("#flower" + year).attr("x")) + 4)
        $("#flower" + year).attr("fill", "lightgray")

        //recover to all
        if (year == "all") {
            for (var i = 0; i < yearindexlist[selectedyear].length; i++) {
                $("#up_petal" + yearindexlist[selectedyear][i]).css("visibility", "hidden")
            };
            $(".hidden_background").css("visibility", "hidden")
            selectedyear = "all"
            return
        }
        ///hide last selected petals
        if (selectedyear != "all") {
            $("#flower" + selectedyear).css("filter", "")
            for (var i = 0; i < yearindexlist[selectedyear].length; i++) {
                $("#up_petal" + yearindexlist[selectedyear][i]).css("visibility", "hidden")
            };
        }
        //show chosen petals
        selectedyear = year
        $(".hidden_background").css("visibility", "visible")
        for (var i = 0; i < yearindexlist[year].length; i++) {
            $("#up_petal" + yearindexlist[year][i]).css("visibility", "visible")
        };
    }
});

$("#status").text("Spark vis is done...")