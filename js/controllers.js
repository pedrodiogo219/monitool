"use strict";

var monitoolControllers = angular.module('MonitoolControllers', ['MonitoolServices']);

monitoolControllers.controller('MenuController', function($scope, $location) {
	$scope.routes = [
		{path: '#projects', name: "Projects"},
		{path: '#indicators', name: "Catalogue Indicateurs"},
		{path: '#inputs', name: "Saisies en attente"},
		{path: '#reporting', name: "Consultation"},
	];

	$scope.isSelected = function(route) {
		return route.path.substring(1) !== $location.path().substring(1);
	};

	$scope.isVisible = function(route) {
		return true;
	};
});


///////////////////////////
// Project
///////////////////////////

monitoolControllers.controller('ProjectListController', function($scope, $location, mtDatabase) {
	mtDatabase.query('monitool/by_type', {include_docs: true, key: 'project'}).then(function(projects) {
		$scope.projects = projects.rows.map(function(row) { return row.doc; });
	});

	$scope.create = function() {
		$location.url('/projects/' + PouchDB.utils.uuid().toLowerCase());
	};
});

monitoolControllers.controller('ProjectDescriptionController', function($scope, $routeParams, $q, mtDatabase) {
	mtDatabase.get($routeParams.projectId).then(function(master) {
		$scope.master = master;
	})
	.catch(function(error) {
		$scope.master = {_id: $routeParams.projectId, type: 'project'};
	})
	.finally(function() {
		$scope.update = function(project) {
			$scope.master = angular.copy(project);
			mtDatabase.put($scope.master).then(function(project) {
				$scope.master._rev = $scope.project._rev = project.rev;
			});
		};

		$scope.reset = function() {
			$scope.project = angular.copy($scope.master);
		};

		$scope.reset();
	});
});

monitoolControllers.controller('ProjectCenterListController', function($scope) {

});

monitoolControllers.controller('ProjectCenterEditController', function($scope) {

});

monitoolControllers.controller('ProjectUserListController', function($scope) {

});

monitoolControllers.controller('ProjectUserEditController', function($scope) {

});

monitoolControllers.controller('ProjectIndicatorListController', function($scope) {

});

monitoolControllers.controller('ProjectIndicatorEditController', function($scope) {

});


///////////////////////////
// Indicators
///////////////////////////

monitoolControllers.controller('IndicatorListController', function($scope) {

});

monitoolControllers.controller('IndicatorEditController', function($scope) {

});

monitoolControllers.controller('TypeEditController', function($scope) {

});

monitoolControllers.controller('ThemeEditController', function($scope) {

});

///////////////////////////
// Input
///////////////////////////

monitoolControllers.controller('InputListController', function($scope, mtDatabase) {

	// Etapes
	//
	// 1. On recupere tous les projets encore en vie.
	//
	// 2. On recupere tous les indicateurs qu'on doit saisir ce mois ci
	//     2.1. On garde les indicateurs sans formule
	//     2.2. On resoud les formules pour obtenir les dependences. 
	//			Si on a des dependences profondes on fait quoi??? (ie, pleins de donnes de base, pas les intermediaires)
	//
	// 3. 

	// var currentMonth = '2014-01';

	// mtDatabase.query('monitool/by_type', {key: 'project', include_docs: true}).then(function(projects) {
	// 	projects = projects.rows.map(function(row) { return row.doc; });

	// 	// Retrieve all indicators that are needed for current month.
	// 	var indicatorsByProjects = {};

	// 	projects.forEach(function(project) {
	// 		var projectIndicators = Object.keys(project.planning).filter(function(indicatorId) {
	// 			var p = project.planning[indicatorId];

	// 			switch (p.periodicity) {
	// 				case 'month': return p.from <= currentMonth && p.to >= currentMonth;
	// 				case 'planned': return false; // @FIXME
	// 				case 'quarter': return false; // @FIXME
	// 				default: throw new Error('Invalid project periodicity.');
	// 			}
	// 		});

	// 		indicatorsByProjects[project._id] = projectIndicators;
	// 		projectIndicators.forEach(function(indicator) {
	// 			indicators[indicator] = true;
	// 		});

	// 	});

	// 	// Resolve dependencies
	// 	mtDatabase.allDocs({keys: Object.keys(indicators), include_docs: true}).then(function(result) {
	// 		// Store all used indicators in the hash
	// 		result.rows.forEach(function(indicator) {
	// 			indicators[indicator.id] = indicator.doc;
	// 		});

	// 		// Add dependencies to all projects.
	// 		for (var projectId in indicatorsByProjects)
	// 			indicatorsByProjects[projectId].requested.forEach(function(indicatorId) {
	// 				var dependencies = indicators[indicatorId];



	// 				// if (indicatorsByProjects[projectId].requested.indexOf(indicatorId))
	// 			});
	// 	});

	// });

});


monitoolControllers.controller('InputEditController', function($scope, $routeParams, $q, mtDatabase, mtInput, mtIndicators) {
	// Retrieve values and description for this form.
	mtDatabase.query('monitool/project_by_center', {key: $routeParams.centerId, include_docs: true}).then(function(result) {
		$scope.project = result.rows[0].doc;
		$scope.center  = $scope.project.center[$routeParams.centerId];

		$q.all([
			mtInput.getFormValues($routeParams.centerId, $routeParams.month),
			mtIndicators.getPlanningDescription($scope.project, $routeParams.month)
		]).then(function(result) {
			$scope.values = result[0];
			$scope.indicators = result[1];
		});
	});

	// Update all indicator on each change until there are no more changes.
	$scope.evaluate = function() {
		mtIndicators.evaluate($scope.indicators, $scope.values);
	};

	// An indicator is disabled when there exists one instance of it that is calculated in the whole form.
	// writing this here is stupid. it should be a property of the input.
	$scope.isDisabled = function(indicatorId) {
		return $scope.indicators.some(function(indicator) {
			return (indicatorId === indicator.id && indicator.compute) ||
				indicator.dependencies.some(function(indicator) {
					return indicatorId === indicator.id && indicator.compute;
				});
		});
	};

	$scope.save = function() {
		mtInput.saveFormValues($routeParams.centerId, $routeParams.month, $scope.values);
	};
});


///////////////////////////
// Reporting
///////////////////////////

monitoolControllers.controller('ReportingByEntitiesController', function($scope, mtStatistics) {

	mtStatistics.getStatistics('project', ['c50da7f0-30d3-4cce-ada5-ab6294cf65c6'], '2014-01', '2014-12').then(function(stats) {
		$scope.stats = stats;
	});

	// $scope.begin          = '2014-01';
	// $scope.end            = '2015-01';
	// $scope.types          = ['project', 'center', 'indicator'];
	// $scope.selectedType   = 'project';
	// $scope.entities       = [];
	// $scope.selectedEntity = null;

	// $scope.updateList = function() {
	// 	var view = 'monitool/by_type',
	// 		opt  = {include_docs: true, key: $scope.selectedType};

	// 	mtDatabase.query(view, opt).then(function(data) {
	// 		$scope.entities = data.rows.map(function(row) { return row.doc; });
	// 		$scope.selectedEntity = $scope.entities.length ? $scope.entities[0] : null;
	// 		if ($scope.selectedEntity)
	// 			$scope.updateData();
	// 	});
	// };

	// $scope.updateData = function() {
	// 	var type  = $scope.selectedType,
	// 		id    = $scope.selectedEntity._id,
	// 		begin = $scope.begin,
	// 		end   = $scope.end;



	// 	mtStatistics.getStatistics(type, id, begin, end).then(function(statistics) {
	// 		$scope.statistics = statistics;

	// 		// type vaut projet, centre ou indicateur.
	// 		// les colonnes sont toujours les mois entre les 2 bornes
	// 		// les lignes sont:
	// 		//		pour projet et centre, les indicateurs disponibles dans le projet.
	// 		//		pour indicateur, les projets qui renseignent cet indicateur.
	// 	});
	// };

	// $scope.updateList();
});


// query = {
// 	type: "project",
// 	ids: [238490234, 234234234, 234234234, 23423423233],
// 	start: "2014-01",
// 	end: "2015-01"
// }
