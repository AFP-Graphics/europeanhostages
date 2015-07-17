(function() {
  'use strict';

  var globals = typeof window === 'undefined' ? global : window;
  if (typeof globals.require === 'function') return;

  var modules = {};
  var cache = {};
  var has = ({}).hasOwnProperty;

  var aliases = {};

  var endsWith = function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  };

  var unalias = function(alias, loaderPath) {
    var start = 0;
    if (loaderPath) {
      if (loaderPath.indexOf('components/' === 0)) {
        start = 'components/'.length;
      }
      if (loaderPath.indexOf('/', start) > 0) {
        loaderPath = loaderPath.substring(start, loaderPath.indexOf('/', start));
      }
    }
    var result = aliases[alias + '/index.js'] || aliases[loaderPath + '/deps/' + alias + '/index.js'];
    if (result) {
      return 'components/' + result.substring(0, result.length - '.js'.length);
    }
    return alias;
  };

  var expand = (function() {
    var reg = /^\.\.?(\/|$)/;
    return function(root, name) {
      var results = [], parts, part;
      parts = (reg.test(name) ? root + '/' + name : name).split('/');
      for (var i = 0, length = parts.length; i < length; i++) {
        part = parts[i];
        if (part === '..') {
          results.pop();
        } else if (part !== '.' && part !== '') {
          results.push(part);
        }
      }
      return results.join('/');
    };
  })();
  var dirname = function(path) {
    return path.split('/').slice(0, -1).join('/');
  };

  var localRequire = function(path) {
    return function(name) {
      var absolute = expand(dirname(path), name);
      return globals.require(absolute, path);
    };
  };

  var initModule = function(name, definition) {
    var module = {id: name, exports: {}};
    cache[name] = module;
    definition(module.exports, localRequire(name), module);
    return module.exports;
  };

  var require = function(name, loaderPath) {
    var path = expand(name, '.');
    if (loaderPath == null) loaderPath = '/';
    path = unalias(name, loaderPath);

    if (has.call(cache, path)) return cache[path].exports;
    if (has.call(modules, path)) return initModule(path, modules[path]);

    var dirIndex = expand(path, './index');
    if (has.call(cache, dirIndex)) return cache[dirIndex].exports;
    if (has.call(modules, dirIndex)) return initModule(dirIndex, modules[dirIndex]);

    throw new Error('Cannot find module "' + name + '" from '+ '"' + loaderPath + '"');
  };

  require.alias = function(from, to) {
    aliases[to] = from;
  };

  require.register = require.define = function(bundle, fn) {
    if (typeof bundle === 'object') {
      for (var key in bundle) {
        if (has.call(bundle, key)) {
          modules[key] = bundle[key];
        }
      }
    } else {
      modules[bundle] = fn;
    }
  };

  require.list = function() {
    var result = [];
    for (var item in modules) {
      if (has.call(modules, item)) {
        result.push(item);
      }
    }
    return result;
  };

  require.brunch = true;
  globals.require = require;
})();
require.register("chart", function(exports, require, module) {
﻿"use strict";
/**
 * Created by julesbonnard
 */

//Containers
var container = d3.select('#dataviz'),
  svg = container.append('svg'),
  chart,
  groupsContainer,
  groups,
  bars,
  barLabels,
  picto_container = {},
  grids,
  extents,

  chartInit = false,

  //Echelles
  x,
  xAxis,
  y,
  colorScale,

  //Tailles
  width,
  height,
  margin = {
    top: 30,
    right: 50,
    bottom: 25,
    left: 15
  },
  getContainerSize = function() {
    width = container[0][0].offsetWidth;
  },
  resize = function() {
    //Définition de la nouvelle hauteur après redimensionnement
    getContainerSize();
    height = data_filtered.length * 20 +60; //Calcul de la hauteur nécessaire pour le SVG
    d3.select('g.x.axis.bottom').attr('transform', 'translate(0,' + (height) + ')');
    svg.attr('width', width)
      .attr('height', height+30);
  },

  //Données
  data_refined,
  data_filtered,
  countries = [],
  hostages,
  hostages_raw,

  //Formats de dates
  format = d3.time.format("%Y-%m-%dT%H:%M:%S"), // Parse this type of date : "2008-10-30T01:00:00"
  formatDisplay = d3.time.format("%B %Y"), //Dates dans les tooltips
  customTimeFormat = d3.time.format("%Y"); //Date sur l'axe x

//Libellés des outcomes
var deathList = ['dead', 'dead (unknown)', 'death', 'dead (attempted rescue)', 'dead (executed)', 'executed', 'dead (illness)', 'died from an infection', 'killed', 'murdered', 'dead (killed)'];
var freeList = ['freed', 'escape', 'freed (released)', 'liberation', 'freed, injured', 'freed (escaped)', 'freedom', 'freed (realesed)', 'liberated for medical reasons', 'freed (liberated)', 'freed ( released)', 'liberated', 'released', 'release', 'liberated (released)', 'freed (unknown)'];

//Accents et fonction pour le fuzzy matching
var accentMap = {
  "á": "a",
  "ö": "o",
  "ï": "i",
  "é": "e",
  "è": "e",
  "ê": "e"
};
var normalize = function(term) {
  var ret = "";
  for (var i = 0; i < term.length; i++) {
    ret += accentMap[term.charAt(i)] || term.charAt(i);
  }
  return ret;
};

getContainerSize();

//Conteneur
chart = svg.append('g')
  .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')')
  .attr('class', 'chart');

//X Axis
chart.append('g')
  .attr('class', 'x axis top');
chart.append('g')
  .attr('class', 'x axis bottom');

d3.select('g.x.axis.top').append('text')
  .attr('class', 'label')
  .text('Years');

//Conteneur des grilles
grids = chart.append('g')
  .attr('class', 'grid x')

//Conteneur des bars
groupsContainer = chart.append('g')
  .attr('class', 'groups');

//Fonction de définition des bornes chronologiques
function extentsTimeline() {
  var min = d3.min(data_refined, function(d) {
    return d.date_taken_hostage;
  });
  var max = d3.max(data_refined, function(d) {
    return d.date_hostage_status_ends;
  });

  return [format.parse(min), format.parse(max)];
}

//Calculer nombre de jours entre deux dates
function dayDiff(d1, d2) {
  d1 = format.parse(d1).getTime() / 86400000;
  if (d2 == null) {
    d2 = new Date().getTime() / 86400000;
  } else {
    d2 = format.parse(d2).getTime() / 86400000;
  }
  return parseInt(new Number(d2 - d1).toFixed(0));
}

//Process des données
function initChart(datafile) {
  //Suppression des dates de début inconnues
  data_refined = datafile.filter(function(d) {
    return d.date_taken_hostage !== null;
  });

  //Calcul de la durée de l'évènement
  data_refined.forEach(function(d, i) {
    data_refined[i]['duration'] = dayDiff(d.date_taken_hostage, d.date_hostage_status_ends);
  });

  //Copie des données pour filtrage
  data_filtered = data_refined;

  chartInit = true;

  // //Enumération et tri des pays
  // hostages_files.forEach(function(d) {
  //     d.is_citizen_of.forEach(function(e) {
  //         countries.push(e.name);
  //     });
  // });

  // countries = _.uniq(countries).sort(function (b, a) {
  //     if (a < b) return 1;
  //     if (b < a) return -1;
  //     return 0;
  // });

  //Suppression de la barre de chargement
  d3.select('#loader').remove();

  //Surveillance du redimensionnement
  d3.select(window).on('resize', Chart.drawGraph);

  //Création du graphique
  Chart.drawGraph();
}

//Data binding
function addBars() {
  //Définition de l'axe vertical
  y = d3.scale.linear().domain([0, data_filtered.length]).range([margin.top, height - margin.bottom]);

  //Liaison des données avec les conteneurs des bars+texte+picto
  groups = groupsContainer.selectAll("g.barGroup")
    .data(data_filtered, function(d) {
      return d.id;
    });

  var groupsEnter = groups.enter().append('g')
    .attr('class', "barGroup")
    .attr("index", function(d, i) {
      return d.id;
    })
    .attr('id', function(d, i) {
      return d.id;
    })
    .attr("transform", function(d, i) {
      return "translate(0, " + y(i) + ")";
    })
    .on('click', function(d) {
      //console.log(d);
      //d3.select(this).classed('selected', !d3.select(this).classed('selected'));
    });

  //ajout des barres
  groupsEnter.append('rect')
    .attr('class', 'bar')
    .attr('x', 0)
    .attr('width', 0)
    .attr('height',10)
    .attr("title", function(d) {
      return 'event,' + d.id;
    })
    .style('fillOpacity',0.4);

  groupsEnter.append('circle')
    .attr('class', 'point start')
    .attr('cx', 0)
    .attr('cy', 4.5)
    .attr('r', 7);

  groupsEnter
    .filter(function(d) {
      return d.date_hostage_status_ends !== null;
    })
    .append('circle')
    .attr('class', 'point end')
    .attr('cx', 0)
    .attr('cy', 4.5)
    .attr('r', 7);

  //ajout des textes
  groupsEnter.append('text')
    .attr('class', 'barLabel')
    .attr("title", function(d) {
      return 'event,' + d.id;
    })
    .attr("data-eventid", function(d) {
      return d.id;
    })
    .attr("data-toggle", "modal")
    .attr("data-target", "#moreInfo")
    .attr('y', 13)
    //TODO : gérer la couleur en CSS
    .attr('fill', '#aaa')
    .on('mouseover', function(d) {
      d3.select(this).attr('fill', 'black');
    })
    .on('mouseout', function(d) {
      d3.select(this).attr('fill', '#aaa');
    })
    .text(function(d) {
      return d.name;
    });

  //Ajout des pictos
  groups
    .each(function(d, i) {
      picto_container[d.id] = d3.select(this).selectAll('.picto')
        .data(d.concerns_these_hostages.filter(filterPictos), function(e) {
          return e.id;
        });

      picto_container[d.id].enter()
        .append('circle')
        .attr('class', 'picto')
        .attr('id', function(e) {
          return e.id;
        })
        .attr('fill', function(e) {
          if (e.outcome != undefined && _.contains(deathList, e.outcome.toLowerCase().trim())) {
            return '#575e61';
          } else if (e.outcome != undefined && _.contains(freeList, e.outcome.toLowerCase().trim())) {
            return '#87b9db';
          } else {
            return '#c4bdb5';
          }
        })
        .attr('cx', 0)
        .attr('cy', 7)
        .attr('r', 7)
        .attr('display', 'none');

      picto_container[d.id].exit().remove();
    });

  //Suppression des groupes non nécesaires
  var groupsExit = groups.exit();
  groupsExit.selectAll('rect').remove();
  groupsExit.selectAll('text').remove();
  groupsExit.remove();
}

//Gestion des transitions
function updateData() {
  switch (UI.currentSort) {
    case 'duration':
      var ticks = 10;
      ticks = width / 70;
      d3.select('g.x.axis.top .label').text('Days');
      break;
    case 'timeline':
      var ticks = 15;
      ticks = width / 70;
      d3.select('g.x.axis.top .label').text('Years');
      break;
    case 'hostages':
      var ticks = 10;
      ticks = width / 70;
      d3.select('g.x.axis.top .label').text('Number of hostages');
      break;
    default:
      var ticks = 5;
  }

  // Modification de l'axe x
  chart.selectAll('g.x.grid>line').remove();
  grids.selectAll('g.x.grid>line')
    .data(x.ticks(ticks))
    .enter().append("line")
    .attr("class", "x")
    .attr("x1", x)
    .attr("x2", x)
    .attr("y1", 30)
    .attr("y2", height);

  //Modification des barres
  bars = groups.selectAll('rect');

  bars.transition()
    .attr('x', function(d) {
      switch (UI.currentSort) {
        case 'duration':
          return x(0);
          break;
        case 'timeline':
          return x(format.parse(d.date_taken_hostage));
          break;
        case 'hostages':
          return x(0);
          break;
      }
    })
    .attr('width', function(d) {
      switch (UI.currentSort) {
        case 'duration':
          return x(d.duration);
          break;
        case 'timeline':
          if (d.date_hostage_status_ends == null) {
            return x(new Date()) - x(format.parse(d.date_taken_hostage));
          }
          return x(format.parse(d.date_hostage_status_ends)) - x(format.parse(d.date_taken_hostage));
          break;
        case 'hostages':
          //return x(d['number_of_hostages_including_non-e30']);
          break;
      }
    })
    .duration(250)
    .delay(0)
    .ease("linear")
    .attr('display', function() {
      switch (UI.currentSort) {
        case 'timeline':
          return 'block';
        case 'duration':
          return 'block';
        default:
          return 'none';
      }
    });

  groups.selectAll('.point.start').transition()
    .attr('cx', function(d) {
      switch (UI.currentSort) {
        case 'duration':
          return x(0);
          break;
        case 'timeline':
          return x(format.parse(d.date_taken_hostage));
          break;
        case 'hostages':
          return x(0);
          break;
      }
    })
    .attr('display', function() {
      switch (UI.currentSort) {
        case 'timeline':
          return 'block';
        case 'duration':
          return 'block';
        default:
          return 'none';
      }
    });

  groups.selectAll('.point.end').transition()
    .attr('cx', function(d) {
      switch (UI.currentSort) {
        case 'duration':
          return x(d.duration);
          break;
        case 'timeline':
          return x(format.parse(d.date_hostage_status_ends));
          break;
        case 'hostages':
          return x(0);
          break;
      }
    })
    .attr('display', function() {
      switch (UI.currentSort) {
        case 'timeline':
          return 'block';
        case 'duration':
          return 'block';
        default:
          return 'none';
      }
    });

  //MAJ des labels
  barLabels = groups.selectAll('text');
  barLabels.transition().attr('x', function(d) {
      switch (UI.currentSort) {
        case 'duration':
          return x(d.duration) + 15;
          break;
        case 'timeline':
          if (d.date_hostage_status_ends == null) {
            return x(format.parse(d.date_taken_hostage)) - 15;
          }
          if (x(format.parse(d.date_taken_hostage)) <= width / 3) {
            return 15 + x(format.parse(d.date_hostage_status_ends));
          } else {
            return x(format.parse(d.date_taken_hostage)) - 15;
          }
          break;
        case 'hostages':
          return x(d.concerns_these_hostages.filter(filterPictos).length) + 30;
          break;
      }
    })
    .attr('text-anchor', function(d) {
      switch (UI.currentSort) {
        case 'duration':
          return 'start';
          break;
        case 'timeline':
          if (x(format.parse(d.date_taken_hostage)) <= width / 3) {
            return 'start';
          } else {
            return 'end';
          }
          break;
        case 'hostages':
          return 'start';
          break;
      }
    })
    .duration(250)
    .delay(0)
    .ease("linear");

  //MAJ des pictos
  groups.each(function(d) {
    picto_container[d.id]
      .sort(function(a, b) {
        return d3.descending(Chart.filterPictosByOutcome(a), Chart.filterPictosByOutcome(b)) || d3.descending(Chart.filterPictosByUnknownOutcome(a), Chart.filterPictosByUnknownOutcome(b));
      })
      .transition()
      .attr('cx', function(e, i) {
        switch (UI.currentSort) {
          case 'duration':
            return 10 + x(d.duration) + i * 17;
            break;
          case 'timeline':
            if (d.date_hostage_status_ends == null) {
              return 10 + x(new Date()) + i * 15;
            }
            return 10 + x(format.parse(d.date_hostage_status_ends)) + i * 17;
            break;
          case 'hostages':
            return x(i + 1);
            break;
        }
      })
      .delay(0)
      .ease("linear")
      .attr('display', function() {
        switch (UI.currentSort) {
          case 'hostages':
            return 'block';
          default:
            return 'none';
        }
      });
  });
}

//Fonction de tri, sélection du tab actif, resize et url
function sortBy(criteria) {
  UI.currentSort = criteria;
  //Sélection du lien actif
  UI.toggleActive(UI.currentSort, 'sort');
  if(chartInit==false) return false;

  resize();
  
  UI.changeUrl();

  switch (criteria) {
    case 'duration':
      var max = d3.max(data_filtered, function(d) {
        return d.duration;
      });
      extents = [0, max + max / 3];

      x = d3.scale.linear().domain(extents).rangeRound([0, width - margin.left - margin.right]);

      xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom')
        .ticks(width / 100)
        .tickSize(2)
        .tickPadding(8);

      chart.selectAll('g.x.axis').call(xAxis);

      chart.selectAll("g.barGroup")
        .sort(function(b, a) {
          return a.duration - b.duration;
        })
        .transition()
        .attr("transform", function(d, i) {
          return "translate(0, " + y(i) + ")";
        });
      d3.selectAll('.legend-locations').classed('nocolor', false);
      d3.selectAll('.legend-hostages').style('display', 'none');
      updateData();
      break;
    case 'timeline':
      extents = extentsTimeline();
      x = d3.time.scale().domain(extents).rangeRound([0, width - margin.left - margin.right]);

      xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom')
        .ticks(width / 100)
        .tickFormat(customTimeFormat)
        .tickSize(2)
        .tickPadding(8);

      chart.selectAll('g.x.axis').call(xAxis);

      chart.selectAll("g.barGroup")
        .sort(function(a, b) {
          return format.parse(a.date_taken_hostage) - format.parse(b.date_taken_hostage);
        })
        .transition()
        .attr("transform", function(d, i) {
          return "translate(0, " + y(i) + ")";
        });
      d3.selectAll('.legend-locations').classed('nocolor', false);
      d3.selectAll('.legend-hostages').style('display', 'none');
      updateData();
      break;
    case 'hostages':
      x = d3.scale.linear().domain([1, 30]).rangeRound([0, width - margin.left - margin.right]);

      xAxis = d3.svg.axis()
        .scale(x)
        .orient('bottom')
        .ticks(width / 150)
        .tickSize(2)
        .tickPadding(8);

      chart.selectAll('g.x.axis').call(xAxis);

      chart.selectAll("g.barGroup")
        .sort(function(b, a) {
          var aHostagesD = a.concerns_these_hostages.filter(Chart.filterPictosByOutcome).length,
            bHostagesD = b.concerns_these_hostages.filter(Chart.filterPictosByOutcome).length,
            aHostagesU = a.concerns_these_hostages.filter(Chart.filterPictosByUnknownOutcome).length,
            bHostagesU = b.concerns_these_hostages.filter(Chart.filterPictosByUnknownOutcome).length,
            aHostages = a.concerns_these_hostages.length,
            bHostages = b.concerns_these_hostages.length;
          if (aHostagesD !== bHostagesD) {
            return d3.ascending(aHostagesD, bHostagesD);
          } else if (aHostagesU !== bHostagesU) {
            return d3.ascending(aHostagesU, bHostagesU);
          } else {
            return d3.ascending(aHostages, bHostages);
          }
        })
        .transition()
        .attr("transform", function(d, i) {
          return "translate(0, " + y(i) + ")";
        });
      d3.selectAll('.legend-locations').classed('nocolor', true);
      d3.selectAll('.legend-hostages').style('display', 'block');
      updateData();
      break;
    default:
  }
}

//Colorier les barres
function colorBy(criteria) {
  UI.currentColor = criteria;
  switch (criteria) {
    case 'locations':
      chart.selectAll("g.barGroup>rect.bar")
        .attr('fill', function(d) {
          return UI.countriesColored[d.happened_in[0]];
        });

      chart.selectAll("g.barGroup>.point")
        .attr('fill', function(d) {
          return UI.countriesColored[d.happened_in[0]];
        });
      break;
    default:
  }
}

//Filtre si la nationalité est sélectionnée dans le select
function filterByNationality(e) {
  switch (UI.nationalitySelected) {
    case 'all':
      return true;
      break;
    default:
      var ok = false;
      e.is_citizen_of.forEach(function(f) {
        if (UI.nationalitySelected == f) {
          ok = true;
        }
      });
      return ok;
      break;
  }
}

//Filtre si le nom ou pays de l'otage est recherché dans le input
function filterPictos(e) {
  var matcher = new RegExp(UI.search, "i"),
  ok;
  if (filterByNationality(e) == true && (UI.search == null || matcher.test(e.name) == true || matcher.test(e.profession_activity) == true)) {
    ok = true;
  }
  //var ok;
  //TODO : fix
  /*e.involved_in_this_event.forEach(function(d) {
      if (matcher.test(d.name) == true || matcher.test(normalize(d.name)) == true) {
          ok = true;
      }
  });*/
  return ok == true;
}

//Filtrer les barres selon la nationalité, le champ de recherche ou le pays sélectionné
function filter() {
  if (UI.nationalitySelected == 'all') {
    data_filtered = data_refined;
  } else {
    data_filtered = data_refined.filter(function(d) {
      var ok;
      d.concerns_these_hostages.forEach(function(e) {
        ok = filterByNationality(e);
      });
      return ok == true;
    });
  }
  if (UI.search !== null) {
    data_filtered = data_filtered.filter(function(d) {
      var matcher = new RegExp(UI.search, "i");
      if (matcher.test(d.name) == true || matcher.test(normalize(d.name)) == true) {
        return true == true;
      } else {
        var ok;
        d.concerns_these_hostages.forEach(function(e) {
          if (matcher.test(e.name) == true || matcher.test(normalize(e.name)) == true || matcher.test(e.profession_activity) == true || matcher.test(e.profession_activity) == true) {
            ok = true;
          }
        });
        d.happened_in.forEach(function(e) {
          if (matcher.test(e) == true || matcher.test(normalize(e)) == true || matcher.test(e.profession_activity) == true || matcher.test(e.profession_activity) == true) {
            ok = true;
          }
        });
        return ok == true;
      }
    })
  }
  if (UI.locations_filtered !== null) {
    data_filtered = data_filtered.filter(function(d) {
      var ok;
      d.happened_in.forEach(function(value, key) {
        if (UI.locations_filtered.indexOf(value) > -1) {
          ok = true;
        }
      });
      return ok == true;
    });
  }
}

//Création du module
var Chart = {
  init: function(datafile) {
    initChart(datafile);
  },
  //Ordre de création du graphique
  drawGraph: function() {
    if(chartInit==false) return false;
    filter();
    resize();
    addBars();
    sortBy(UI.currentSort);
    colorBy(UI.currentColor);
  },
  //Sélectionner seulement les otages selon l'issue
  filterPictosByOutcome: function(e) {
    if (e.outcome !== undefined) {
      return _.contains(deathList, e.outcome.toLowerCase().trim()) == true;
    } else {
      return false;
    }
  },
  //Idem pour les issues inconnues
  filterPictosByUnknownOutcome: function(e) {
    if (e.outcome !== undefined) {
      if (_.contains(freeList, e.outcome.toLowerCase().trim()) == false && _.contains(deathList, e.outcome.toLowerCase().trim()) == false) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  },
  sortBy: function(criteria) {
    sortBy(criteria);
  },
  data_indexed: null,
  deathList: deathList,
  freeList: freeList
};

module.exports = Chart;
});

require.register("map", function(exports, require, module) {
"use strict";
/**
 * Created by julesbonnard.
 */

//Création de la carte
L.mapbox.accessToken =
  'pk.eyJ1IjoiYWdlbmNlZnJhbmNlcHJlc3NlIiwiYSI6Ijk5YjI2NGE0MDdlYTE1NGY5ZjVjYmMwYjJmNjY3ZWJlIn0.crFebhJyP1aJ7uY2B12C2A';
var map = L.mapbox.map('leafletMap', 'agencefrancepresse.6906a779', {
  center: new L.LatLng(29, 16),
  maxBounds: [
    [84, 149],
    [-76, -133]
  ],
  maxZoom: 5,
  minZoom: 1,
  zoomControl: false,
  legendControl: {
    position: 'topleft'
  }
});
if (d3.select('#map')[0][0].offsetWidth > 460) {
  map.setZoom(2);
} else {
  map.setZoom(1);
}
// Disable drag and zoom handlers.
map.scrollWheelZoom.disable();
new L.Control.Zoom({
  position: 'topright'
}).addTo(map);
map.legendControl.addLegend(document.getElementById('mapInfo').innerHTML);

function updateList(timeline) {
  var displayed = timeline.getDisplayed();
  var list = document.getElementById('displayed-list');
  list.innerHTML = "";
  displayed.forEach(function(event) {
    var li = document.createElement('li');
    li.innerHTML = event.properties.name;
    li.setAttribute('data-eventId', event.properties.id);
    li.setAttribute('data-toggle', "modal");
    li.setAttribute('data-target', "#moreInfo");
    list.appendChild(li);
  });
}
function addTimeline(geojson) {
  geojson.features.forEach(function(hevent,key) {
    if(Chart.data_indexed[hevent.properties.id]!==undefined) {
      geojson.features[key].properties.id = parseInt(hevent.properties.id);
      geojson.features[key].properties.name = Chart.data_indexed[hevent.properties.id].name;
      geojson.features[key].properties.start = Chart.data_indexed[hevent.properties.id].date_taken_hostage;
      if(Chart.data_indexed[hevent.properties.id].date_hostage_status_ends == null) {
        geojson.features[key].properties.end = new Date();
      }
      else {
        geojson.features[key].properties.end = Chart.data_indexed[hevent.properties.id].date_hostage_status_ends;
      }
    }
  });
  var timeline = L.timeline(geojson, {
    formatDate: function(date) {
      return moment(date).format("YYYY");
    },
    pointToLayer: function(geojson, latlng) { 
      return L.circleMarker(latlng, {
        radius: Math.sqrt(Chart.data_indexed[geojson.properties.id].concerns_these_hostages.length *Math.PI) *3,
        color: "#fff",
        fillColor: "#0096c7",
        opacity: 1,
        fillOpacity: 1
      });
    },
    position: 'bottomleft',
    waitToUpdateMap: false,
    showTicks: true,
    enablePlayback: true
  });
  timeline.addTo(map);
  timeline.on('change', function(e) {
    updateList(e.target);
  });
  timeline.on('click', function(e) {
    UI.moreInfoId = e.layer.feature.properties.id;
    $('#moreInfo').modal(e);
  })
  updateList(timeline);
  //Suppression de la barre de chargement
  d3.select('#loader').remove();
}

//Création du module
var Map = {
  init: function(geojson) {
    addTimeline(geojson);
  },
  resize: function() {
    map.invalidateSize();
  }
};

module.exports = Map;

});

require.register("ui", function(exports, require, module) {
"use strict";
/**
 * Created by julesbonnard.
 */
var url = new URI(window.location.href); //Détection de l'URL et parsing avec URI;

//Création du module
var UI = {
  url: url,

  //Etapes de l'appli
  currentSort: url.search(true).sort || 'timeline',
  currentColor: 'locations',
  nationalitySelected: slashRemove(url.search(true).nationality) || 'all',
  search: slashRemove(url.search(true).search) || null,
  locations_filtered: url.search(true).locations || null,

  //Conteneur des couleurs pour les barres
  countriesColored: {},
  //conteneur de l'identifiant pour l'affichage du modal
  moreInfoId: null,

  //Changer la couleur des liens du menu
  toggleActive: function(link, type) {
    d3.selectAll('.' + type).classed('active', 0);
    d3.selectAll("." + link).classed('active', 1);
    _gaq.push(['_trackEvent', 'tabs', 'show', link]);
  },
  //Changement de l'URL en fonction des paramètres
  changeUrl: function() {
    UI.url.setSearch({
      sort: UI.currentSort,
      locations: UI.locations_filtered,
      nationality: UI.nationalitySelected
    });
    if (typeof(history.pushState) != "undefined") {
      var obj = {
        Title: $(document).find("title").text(),
        Url: UI.url.resource()
      };
      history.pushState(obj, obj.Title, obj.Url);
    } else {
      console.warn("Browser does not support HTML5.");
    }
  }
};

//Sélection de l'onglet actif
if (UI.currentSort == 'map') {
  $('#tabs a[href="#map"]').tab('show');
} else if (UI.currentSort == 'about') {
  $('#tabs a[href="#about"]').tab('show');
} else {
  $('#tabs a[href="#data"]').tab('show');
}
//Comportement au clic
$('nav li a').on('click', function() {
  $(this).tab('show');
  Chart.sortBy(this.getAttribute('data-tabtarget'));
  if (this.dataset.tabtarget == "map" && Map !== undefined) Map.resize();
  return false;
});

//Retirer les slashs qui apparaissent à la fin de l'url
function slashRemove(item) {
  var slashRemove = new RegExp("/", 'g');
  if (item !== null && item !== undefined) {
    item = item.replace(slashRemove, "");
  }
  return item;
}


//Possibilité d'afficher seulement la dataviz
if (UI.url.search(true).header == 'hidden') {
  d3.select("header").style('display', 'none');
  d3.select(".menu-block").style('display', 'none');
  d3.select(".legend").style('display', 'none');
  d3.select(".source").style('display', 'block');
}


//Remplir un tableau de couleurs par pays
//Liste des régions et couleurs (Définition de l'ONU -> http://unstats.un.org/unsd/methods/m49/m49regin.htm)
var countriesColors = [{
  'name': 'North Africa',
  'countries': ["algeria","egypt","tunisia","libya","sudan"],
  'color': '#ffe17e'
}, {
  'name': 'West Africa',
  'countries': ["ivory coast", "mali","niger","nigeria", "mauritania"],
  'color': '#f1923f'
}, {
  'name': 'Central Africa',
  'countries': ["angola","cameroon","central african republic","chad","democratic republic of congo"],
  'color': '#de9f6b'
}, {
  'name': 'East Africa',
  'countries': ["ethiopia","kenya","rwanda","seychelles","somalia","south sudan"],
  'color': '#a17457'
}, {
  'name': 'Middle East',
  'countries': ['turkey', 'lebanon', 'iraq', 'syria','palestine', 'israel', 'yemen', 'saudi arabia'],
  'color': '#6269ad'
}, {
  'name': 'South America',
  'countries': ['colombia', 'venezuela', 'guatemala', 'mexico'],
  'color': '#6db6a6'
}, {
  'name': 'Russia-Georgia',
  'countries': ['russia', 'georgia'],
  'color': '#ee8280'
}, {
  'name': 'Asia',
  'countries': ['pakistan', 'afghanistan', 'philippines', 'india', 'cambodia'],
  'color': '#afaaa2'
}];

countriesColors.forEach(function(value, key) {
  value.countries.forEach(function(value2, key2) {
    UI.countriesColored[value2] = value.color;
  });
});

function toTitleCase(str)
{
    return ' '+str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

//Créer la légende
d3.select('ul.legend-locations').selectAll('.legend-locations li').data(countriesColors).enter()
  .append('li')
  .attr('title', function(d) {
    return d.countries.map(toTitleCase).concat();
  })
  .text(function(d) {
    return d.name;
  })
  .on('click', function(d) {
    if (UI.locations_filtered == d.countries) {
      UI.locations_filtered = null;
      d3.select('ul.legend-locations li.selected').classed('selected', false);
      d3.selectAll('ul.legend-locations,.removeFilters').classed('selected', false);
    } else {
      d3.selectAll('ul.legend-locations,.removeFilters').classed('selected', true);
      d3.select('ul.legend-locations li.selected').classed('selected', false);
      d3.select(this).classed('selected', true);
      UI.locations_filtered = d.countries;
    }
    Chart.drawGraph();
  })
  .append('span')
  .style('background', function(d) {
    return d.color;
  });
//Bouton supprimer les filtres
$('.removeFilters').on('click', function() {
  UI.locations_filtered = null;
  d3.select('ul.legend-locations li.selected').classed('selected', false);
  d3.selectAll('ul.legend-locations,.removeFilters').classed('selected', false);
  Chart.drawGraph();
});
//Sélection le filtre actif
if (UI.locations_filtered !== null) {
  d3.selectAll('.legend-locations li').each(function(d) {
    if (d.countries[0] == UI.locations_filtered[0]) {
      d3.selectAll('ul.legend-locations,.removeFilters').classed('selected', true);
      d3.select(this).attr('class', 'selected');
    }
  });
}

//Fonctionnement du select
d3.select('#countries').on('change', function() {
  UI.nationalitySelected = this.options[this.selectedIndex].value;
  Chart.drawGraph();
});
//Sélection du filtre selon l'URL ou par défaut
if (UI.url.search(true).nationality !== undefined) {
  d3.select('#countries option[value=' + UI.nationalitySelected + ']').attr('selected', 'selected');
}
//et du champ recherche
d3.select('#search').attr('value', UI.search);



//Configuration du modal Bootstrap pour plus d'infos
$('#moreInfo').on('show.bs.modal', function(e) {
  if (e.relatedTarget !== undefined) {
    var recipient = e.relatedTarget.__data__.id;
    var hostageEvent = Chart.data_indexed[recipient];
  } else {
    var hostageEvent = Chart.data_indexed[UI.moreInfoId];
  }

  var duration;

  if (hostageEvent.duration <= 1) {
    duration = 'a day or less';
  } else {
    duration = moment.duration(hostageEvent.duration, 'days').humanize();
  }

  var hostagesTable = '<div class="listHostages row">';
  hostageEvent.concerns_these_hostages.sort(function(a, b) {
    return d3.descending(Chart.filterPictosByOutcome(a), Chart.filterPictosByOutcome(b)) || d3.descending(Chart.filterPictosByUnknownOutcome(a), Chart.filterPictosByUnknownOutcome(b));
  }).forEach(function(value, key) {
    hostagesTable += '<div class="col-xs-12 col-sm-6 col-lg-6">' + value.name.split('[')[0].trim();
    if (value.outcome != undefined && _.contains(Chart.deathList, value.outcome.toLowerCase().trim())) {
      hostagesTable += ' <span class="label label-default">' + value.outcome + '</span>';
    } else if (value.outcome != undefined && _.contains(Chart.freeList, value.outcome.toLowerCase().trim())) {
      hostagesTable += ' <span class="label label-primary">' + value.outcome + '</span>';
    } else {
      hostagesTable += ' <span class="label label-warning">' + value.outcome + '</span>';
    }
    hostagesTable += '</div>';
  });
  hostagesTable += '</div>';

  //var title = '<a target="_blank" href="https://www.detective.io/afp/hostage-project/contribute/?type=hostageevent&id=' + hostageEvent.id + '">' + hostageEvent.name + '</a>';
  var title = hostageEvent.name;

  _gaq.push(['_trackEvent', 'modal', 'show', hostageEvent.name]);
  var modal = $(this);
  modal.find('.modal-header').css('background-color', UI.countriesColored[hostageEvent.happened_in[0]]);
  modal.find('.modal-title').html(title);
  modal.find('.duration').text(duration);
  modal.find('.hostages').html(hostagesTable);
  modal.find('.modal-body .description').html(hostageEvent.description);
});


//Comportement du champ recherche. Timeout pour fluidité
var timeout;
d3.select('#search').on('input', function(d) {
  var that = this;
  clearTimeout(timeout);
  timeout = setTimeout(function() {
    if (that.value.length >= 3) {
      UI.search = that.value;
      UI.url.setSearch({
        search: UI.search
      });
      Chart.drawGraph();
    }
    if (that.value.length == 0) {
      UI.search = null;
      UI.url.removeSearch('search');
      Chart.drawGraph();
    }
  }, 300);
});

//Ouverture d'un popup au clic sur les réseaux sociaux
function fbs_click(link, width, height) {
  var leftPosition, topPosition;
  //Allow for borders.
  leftPosition = (window.screen.width / 2) - ((width / 2) + 10);
  //Allow for title and status bars.
  topPosition = (window.screen.height / 2) - ((height / 2) + 50);
  var windowFeatures = "status=no,height=" + height + ",width=" + width + ",resizable=yes,left=" + leftPosition + ",top=" + topPosition + ",screenX=" + leftPosition + ",screenY=" + topPosition + ",toolbar=no,menubar=no,scrollbars=no,location=no,directories=no";
  window.open(link.href, 'sharer', windowFeatures);
  return false;
}
$('#twitterButton a,#facebookButton a').on('click', function() {
  fbs_click(this, 700, 300);
  return false;
});


module.exports = UI;
});


//# sourceMappingURL=app.js.map