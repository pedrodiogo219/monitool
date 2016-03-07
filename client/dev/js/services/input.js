"use strict";

angular
	
	// Define module
	.module(
		'monitool.services.models.input',
		[
			'ngResource'
		]
	)

	// Define Input factory
	.factory('Input', function($resource, $q) {

		// this has nothing to do on the root scope.
		// => move it to a service and factorize with the similiar function in mtReporting
		var _getPeriods = function(entity, form, project) {
			var periods;
			if (['year', 'quarter', 'month', 'week', 'day'].indexOf(form.periodicity) !== -1) {
				var period = form.periodicity === 'week' ? 'isoWeek' : form.periodicity;

				var current, end;
				if (entity) {
					// FIXME spaghettis
					if (!entity.start && !form.start)
						current = moment(project.start).startOf(period);
					else if (!entity.start && form.start)
						current = moment(form.start).startOf(period);
					else if (entity.start && !form.start)
						current = moment(entity.start).startOf(period);
					else
						current = moment.max(moment(entity.start), moment(form.start)).startOf(period);

					if (!entity.end && !form.end)
						end = moment(project.end).startOf(period);
					else if (!entity.end && form.end)
						end = moment(form.end).startOf(period);
					else if (entity.end && !form.end)
						end = moment(entity.end).startOf(period);
					else
						end = moment.min(moment(entity.end), moment(form.end)).startOf(period);
				}
				else {
					current = moment(form.start || project.start).startOf(period),
					end     = moment(form.end || project.end).endOf(period);
				}

				if (end.isAfter()) // do not allow to go in the future
					end = moment();

				periods = [];
				while (current.isBefore(end)) {
					periods.push(current.clone());
					current.add(1, form.periodicity);
				}
			}
			else if (form.periodicity === 'free') {
				periods = [];
			}
			else
				throw new Error(form.periodicity + ' is not a valid periodicity');

			return periods;
		};

		// Create $resource
		var Input = $resource('/resources/input/:id', { id: "@_id" }, { save: { method: "PUT" }});

		/**
		 * Factory with default value
		 */
		Input.makeNew = function(projectId, form, period, entityId) {
			var input = new Input({
				_id: [projectId, entityId, form.id, period].join(':'),
				type: "input",
				project: projectId,
				form: form.id,
				period: period,
				entity: entityId,
				values: {}
			});

			form.elements.forEach(function(element) {
				var numFields = 1;
				element.partitions.forEach(function(partition) {
					numFields *= partition.length;
				});
				
				input.values[element.id] = new Array(numFields);
				for (var i = 0; i < numFields; ++i)
					input.values[element.id][i] = 0;
			});

			return input;
		};

		Input.fetchProjectStatus = function(project) {
			return Input.query({mode: 'project_input_ids', projectId: project._id}).$promise.then(function(inputsDone) {
				var prj = {};

				inputsDone.forEach(function(inputId) {
					var splitted      = inputId.split(':'),
						projectId     = splitted[0],
						inputEntityId = splitted[1],
						formId        = splitted[2],
						strPeriod     = splitted[3];

					prj[formId] = prj[formId] || {};
					prj[formId][strPeriod] = prj[formId][strPeriod] || {};
					prj[formId][strPeriod][inputEntityId] = 'outofschedule';
				});

				project.forms.forEach(function(form) {
					prj[form.id] = prj[form.id] || {};

					if (form.collect === 'some_entity') {
						form.entities.forEach(function(entityId) {
							var inputEntity = project.entities.find(function(entity) { return entity.id == entityId; });

							_getPeriods(inputEntity, form, project).forEach(function(period) {
								var strPeriod = period.format('YYYY-MM-DD');

								prj[form.id][strPeriod] = prj[form.id][strPeriod] || {}

								if (prj[form.id][strPeriod][inputEntity.id] == 'outofschedule')
									prj[form.id][strPeriod][inputEntity.id] = 'done';
								else
									prj[form.id][strPeriod][inputEntity.id] = 'expected';
							});
						});
					}
					else if (form.collect === 'entity')
						project.entities.forEach(function(inputEntity) {
							_getPeriods(inputEntity, form, project).forEach(function(period) {
								var strPeriod = period.format('YYYY-MM-DD');

								prj[form.id][strPeriod] = prj[form.id][strPeriod] || {}

								if (prj[form.id][strPeriod][inputEntity.id] == 'outofschedule')
									prj[form.id][strPeriod][inputEntity.id] = 'done';
								else
									prj[form.id][strPeriod][inputEntity.id] = 'expected';
							});
						});
					
					else if (form.collect === 'project')
						_getPeriods(null, form, project).forEach(function(period) {
							var strPeriod = period.format('YYYY-MM-DD');

							prj[form.id][strPeriod] = prj[form.id][strPeriod] || {}

							if (prj[form.id][strPeriod].none == 'outofschedule')
								prj[form.id][strPeriod].none = 'done';
							else
								prj[form.id][strPeriod].none = 'expected';
						});
					
					else
						throw new Error('Invalid form.collect value.');
				});

				return prj;
			});
		};

		Input.fetchLasts = function(projectId, entityId, form, period) {
			return Input.query({
				mode: "current+last",
				projectId: projectId,
				entityId: entityId,
				formId: form.id,
				period: period
			}).$promise.then(function(result) {
				// result.forEach(function(input) { input.sanitize(form); });

				var currentInputId = [projectId, entityId, form.id, period].join(':');

				// both where found
				if (result.length === 2) 
					return { current: result[0], previous: result[1], isNew: false };

				// only the current one was found
				else if (result.length === 1 && result[0]._id === currentInputId) 
					return { current: result[0], previous: null, isNew: false };

				// the current one was not found (and we may or not have found the previous one).
				return {
					current: Input.makeNew(projectId, form, period, entityId),
					previous: result.length ? result[0] : null,
					isNew: true
				};
			});
		};


		Input.fetchForProject = function(project) {
			return this.fetchForProjects([project]);
		};

		Input.fetchForProjects = function(projects) {
			// Index forms by their uuid.
			var formsById = {}, validInputIds = {};

			// list all possible input ids to exclude inputs that are out of calendar.
			projects.forEach(function(project) {
				project.forms.forEach(function(form) {
					formsById[form.id] = form;

					if (form.collect === 'some_entity')
						form.entities.forEach(function(entityId) {
							var inputEntity = project.entities.find(function(entity) { return entity.id == entityId; });
							_getPeriods(inputEntity, form, project).forEach(function(period) {
								validInputIds[project._id + ':' + inputEntity.id + ':' + form.id + ':' + period.format('YYYY-MM-DD')] = true;
							});
						});

					else if (form.collect === 'entity')
						project.entities.forEach(function(inputEntity) {
							_getPeriods(inputEntity, form, project).forEach(function(period) {
								validInputIds[project._id + ':' + inputEntity.id + ':' + form.id + ':' + period.format('YYYY-MM-DD')] = true;
							});
						});
					
					else if (form.collect === 'project')
						_getPeriods(null, form, project).forEach(function(period) {
							validInputIds[project._id + ':none:' + form.id + ':' + period.format('YYYY-MM-DD')] = true;
						});
					
					else
						throw new Error('Invalid form.collect value.');
				});
			});

			// Buid promises for each project's inputs.
			var promises = projects.map(function(project) {
				return Input.query({mode: "project_inputs", projectId: project._id}).$promise;
			});

			return $q.all(promises).then(function(inputs) {
				// Reduce the inputs array.
				inputs = inputs.reduce(function(m, i) {
					return m.concat(i);
				}, []);

				// remove inputs that have no matching form
				inputs = inputs.filter(function(input) {
					if (!formsById[input.form] || !validInputIds[input._id])
						console.log('Dropping input: ', input._id);

					return formsById[input.form] && validInputIds[input._id];
				});

				return inputs;
			});
		};

		return Input;
	});
