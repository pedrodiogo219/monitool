
import axios from 'axios';
import TimeSlot, {timeSlotRange} from 'timeslot-dag';


const TIME_PERIODICITIES = [
	'day', 'month_week_sat', 'month_week_sun', 'month_week_mon', 'week_sat', 'week_sun',
	'week_mon', 'month', 'quarter', 'semester', 'year'
];


function* _generatePeriods(project, indicator, filter) {
	const parameters = Object.values(indicator.computation.parameters);
	const dataSources = project.forms.filter(ds => {
		return parameters.some(param => ds.elements.some(v => v.id === param.elementId));
	});

	// Get list of periodicities which are compatible with the computation
	const periodicities = TIME_PERIODICITIES.filter(periodicity => {
		const validForIndicator = dataSources.every(dataSource => {
			if (dataSource.periodicity === 'free' || periodicity === dataSource.periodicity)
				return true;

			try {
				let t = TimeSlot.fromDate(new Date(), dataSource.periodicity);
				t.toUpperSlot(periodicity);
				return true;
			}
			catch (e) {
				return false;
			}
		});

		if (!validForIndicator)
			return false;

		// can't disagregate twice by the same periodicity
		if (filter[periodicity])
			return false;

		// can't disaggregate by a parent periodicity
		for (let key in filter) {
			if (TIME_PERIODICITIES.includes(key) && filter[key].length < 2) { // don't invert the test: it will crash
				try {
					let t = TimeSlot.fromDate(new Date(), key);
					t.toUpperSlot(periodicity);
					return false;
				}
				catch (e) {
				}
			}
		}

		return true;
	});

	// Get the most restrictive possible start & end date by scanning all filters, project limits, ds limits, ...
	// (logframe limits are within the filter because they get injected elsewhere).
	const starts = [filter._start, ...dataSources.map(ds => ds.start)];
	const ends = [filter._end, ...dataSources.map(ds => ds.end)]
	for (let key in filter)
		if (TIME_PERIODICITIES.includes(key)) {
			starts.push(new TimeSlot(filter[key][0]).firstDate.toISOString().slice(0, 10));
			ends.push(new TimeSlot(filter[key][filter[key].length - 1]).lastDate.toISOString().slice(0, 10));
		}

	const start = starts.reduce((memo, date) => date && date > memo ? date : memo, project.start);
	const end = ends.reduce((memo, date) => date && date < memo ? date : memo, project.end);

	// Create dimensions
	for (let periodicity of periodicities) {
		const rows = Array
			.from(timeSlotRange(
				TimeSlot.fromDate(new Date(start + 'T00:00:00Z'), periodicity),
				TimeSlot.fromDate(new Date(end + 'T00:00:00Z'), periodicity)
			))
			.map(slot => {
				return {
					id: slot.value,
					name: slot.value,
					isGroup: periodicity !== periodicities[0],
					indicator: indicator,
					filter: {
						[periodicity]: [slot.value] // FIXME would be better to use the native periodicity of the data source.
					}
				};
			});

		yield {
			id: periodicity,
			name: 'project.dimensions.' + periodicity,
			exclude: TIME_PERIODICITIES,
			rows: rows
		};
	}
}


// intersection of sites that are in this computation
function* _generateSites(project, indicator, filter) {
	// no entity dimension if already filtered as much as possible.
	if (filter.entity && (/*filter.entity.length < 2 || */filter.entity.final))
		return;

	const parameters = Object.values(indicator.computation.parameters);
	const dataSources = project.forms.filter(ds => {
		return parameters.some(param => ds.elements.some(variable => variable.id === param.elementId));
	});

	const siteRows = project.entities
		// We have an
		// - Indicator defined by 100 * a / b
		// - 3 sites: Paris, Madrid and London
		// - a is collected only for paris and madrid
		// - b is collected only for madrid and london
		//
		// => We can't compute the indicator for paris and london, but we can for madrid.
		// => The condition for a site to have a subrow is that it must be present in ALL the parameters origin data source.
		.filter(site => {
			if (!dataSources.every(ds => ds.entities.includes(site.id)))
				return false;

			if (filter.entity && !filter.entity.includes(site.id))
				return false;

			return true;
		})
		.map(site => {
			return {
				id: site.id,
				name: site.name,
				isGroup: false,
				indicator: indicator,
				filter: {
					entity: [site.id]
				}
			}
		});

	const groupRows = project.groups
		// The case for groups is a bit more complicated.
		// Same situation as before, our groups are "Continental" with Paris and Madrid, and Islanders with london.
		//
		// => For continental, the indicator value will be 100 * (Aparis + Amadrid) / Bmadrid
		// => For islanders, the indicator would be 100 * (?) / Blondon => it must be excluded as there is no value for A
		//
		// The condition for a group to be included is that for all parameters, the group must provide a value.
		// Which means, for all parameters, there must be an intersection between the group members and the data source providing the param.
		.filter(group => {
			// <=> for all dataSource, ds.entities intersection with group.members is non empty
			if (!dataSources.every(ds => ds.entities.some(siteId => group.members.includes(siteId))))
				return false;

			if (filter.entity && !filter.entity.some(siteId => group.members.includes(siteId)))
				return false;

			return true;
		})
		.map(group => {
			return {
				id: group.id,
				name: group.name,
				isGroup: true,
				indicator: indicator,
				filter: {
					entity: group.members // we could intersect this with the union of param's siteIds.
				}
			}
		});

	yield {
		id: 'entity',
		name: 'project.dimensions.entity',
		exclude: ['entity', 'group'],
		rows: [...groupRows, ...siteRows]
	};
}


function* _generatePartitions(project, indicator, filter) {
	// Get all variables and computations parameters in arrays.
	const variables = project.forms.reduce((m, e) => m.concat(e.elements), []);
	const parameters = Object.values(indicator.computation.parameters);

	// Get partitions which are available in all variables used for the computation (<=> intersect parameters)
	let commonPartitions = parameters.reduce((memo, param) => {
		const partitions = variables.find(v => v.id === param.elementId).partitions;
		if (memo !== null)
			return partitions.filter(p => memo.some(p2 => p2.id == p.id))
		else
			return partitions;
	}, null) || [];

	// Remove partitions that are part of the computation.
	commonPartitions = commonPartitions.filter(partition => {
		return parameters.every(param => !param.filter[partition.id])
	});

	// Build dimensions
	for (let partition of commonPartitions) {
		// skip partitions that are already filtered to single element or that are marked as final
		if (filter[partition.id] && (/*filter[partition.id].length < 2 || */filter[partition.id].final))
			continue;

		const elementRows = partition.elements
			.filter(element => !filter[partition.id] || filter[partition.id].includes(element.id))
			.map(element => {
				return {
					id: element.id,
					name: element.name,
					isGroup: false,
					indicator: indicator,
					filter: {[partition.id]: [element.id]}
				};
			})

		const groupRows = partition.groups
			.filter(group => !filter[partition.id] || filter[partition.id].some(peid => group.members.includes(peid)))
			.map(group => {
				return {
					id: group.id,
					name: group.name,
					isGroup: true,
					indicator: indicator,
					filter: {[partition.id]: group.members}
				};
			});

		yield {
			id: partition.id,
			name: partition.name,
			exclude: [partition.id],
			rows: [...groupRows, ...elementRows]
		};
	}
}

function* _generateParameters(project, indicator, filter) {
	const variables = project.forms.reduce((memo, ds) => [...memo, ...ds.elements], []);

	const rows = [];
	for (let paramId in indicator.computation.parameters) {
		const param = indicator.computation.parameters[paramId];
		const variable = variables.find(v => v.id == param.elementId);

		rows.push({
			id: paramId,
			name: paramId + ' (' + variable.name + ')',
			isGroup: false,
			indicator: {
				id: paramId,
				display: variable.name,
				computation: {formula: paramId, parameters: {[paramId]: param}},
				colorization: false,
				baseline: null,
				target: null,
			},
			filter: {}
		});
	}

	if (rows.length > 1)
		yield {
			id: 'computation',
			name: 'project.computation',
			exclude: [],
			rows: rows
		}
}

export function generateIndicatorDimensions(project, indicator, filter) {
	if (!indicator.computation)
		return [];

	return [
		..._generateParameters(project, indicator, filter),
		..._generatePeriods(project, indicator, filter),
		..._generateSites(project, indicator, filter),
		..._generatePartitions(project, indicator, filter),
	].filter(dim => dim.rows.length !== 0);
}



export function *generateProjectDimensions(project) {
	// Time
	const timeVariants = {};

	timePeriodicities.forEach(periodicity => {

		let isValid = false;
		for (let dataSource of project.forms) {
			if (dataSource.periodicity === 'free' || dataSource.periodicity === periodicity) {
				isValid = true;
				break
			}

			try {
				TimeSlot
					.fromDate(new Date(), dataSource.periodicity)
					.toUpperSlot(periodicity);

				isValid = true;
				break;
			}
			catch (e) {}
		}

		if (isValid)
			timeVariants[periodicity] = Array
				.from(timeSlotRange(
					TimeSlot.fromDate(new Date(start + 'T00:00:00Z'), this.groupBy),
					TimeSlot.fromDate(new Date(end + 'T00:00:00Z'), this.groupBy)
				))
				.map(slot => slot.id);
	});

	// Sites
	const siteVariants = {}

	siteVariants['elements'] = project.entities.map(site => {
		return {id: site.id, name: site.name, filter: [site.id]};
	});

	if (project.groups) {
		siteVariants['groups'] = project.groups.map(group => {
			return {id: group.id, name: group.name, filter: group.members};
		});

		siteVariants['both'] = [...siteVariants['groups'], ...siteVariants['elements']];
	}

	yield {id: 'site', variants: siteVariants};
}



/**
 * A periodicity is compatible with a given indicator if
 * _all_ of the composing parameters can be converted to it.
 */
export function computeCompatiblePeriodicities(project, computation) { //fixme replace by indicator computation
	if (!computation)
		return [];

	const variableIds = Object
		.values(computation.parameters)
		.map(param => param.elementId);

	const dsPeriodicities = project.forms
		.filter(ds => ds.elements.some(variable => variableIds.includes(variable.id)))
		.map(ds => ds.periodicity);

	return TIME_PERIODICITIES.filter(periodicity => {
		return dsPeriodicities.every(dsPeriodicity => {
			if (dsPeriodicity === 'free' || periodicity === dsPeriodicity)
				return true;

			try {
				let t = TimeSlot.fromDate(new Date(), dsPeriodicity);
				t.toUpperSlot(periodicity);
				return true;
			}
			catch (e) {
				return false;
			}
		});
	});
};

export function computeSplitPartitions(project, computation) {
	if (!computation)
		return [];

	// We need to keep only partitions that are common to all variables.
	const result = Object
		.values(computation.parameters)
		.reduce((memo, param) => {
			let partitions = project.forms
				.reduce((m, e) => m.concat(e.elements), [])
				.find(v => v.id === param.elementId)
				.partitions
				.filter(p => !param.filter[p.id])

			// intersect with memo
			if (memo)
				partitions = partitions.filter(p => memo.some(p2 => p2.id == p.id));

			return partitions;
		}, null);

	// do not return null when formula is a fixed value.
	return result ? result : [];
}

// implement _fetch method here, and call it from the components
export async function fetchData(project, computation, dimensionIds, filter, withTotals, withGroups) {
	// No need to load if no computation is defined for the indicator.
	if (!computation)
		throw new Error('project.indicator_computation_missing');

	// No need to load if the periodicity is not available.
	const periodicities = computeCompatiblePeriodicities(project, computation);
	dimensionIds.forEach(dimensionId => {
		if (TIME_PERIODICITIES.includes(dimensionId) && !periodicities.includes(dimensionId))
			throw new Error('project.not_available_min_' + periodicities[0])
	});

	// No need to load if any filter is empty
	for (let f of Object.values(filter)) {
		if (Array.isArray(f) && f.length === 0)
			return {};
	}

	// No need to load if value is fixed.
	if (Object.keys(computation.parameters).length === 0) {
		let result = parseFloat(computation.formula);
		for (let i = dimensionIds.length - 1; i >= 0; --i) {
			const dimId = dimensionIds[i];
			const newResult = {};

			let ids;
			if (filter[dimId])
				ids = filter[dimId]
			else if (periodicities.includes(dimId)) {
				ids = Array.from(
					timeSlotRange(
						TimeSlot.fromDate(new Date(filter._start + 'T00:00:00Z'), dimId),
						TimeSlot.fromDate(new Date(filter._end + 'T00:00:00Z'), dimId)
					)
				).map(s => s.value);
			}
			else
				throw new Error('could not find elements for ' + dimId)

			ids.forEach(id => newResult[id] = result);

			if (withGroups) {
				// throw new Error('')
			}

			if (withTotals)
				newResult._total = result;


			result = newResult;
		}

		return result;
	}

	// Otherwise, call the server for the data.
	const url = '/api/reporting/project/' + project._id;
	const data = {
		computation: computation,
		dimensionIds: dimensionIds,
		filter: filter,
		withTotals: withTotals,
		withGroups: withGroups
	};

	try {
		const response = await axios.post(url, data);
		return response.data;
	}
	catch (e) {
		// Try to fail with the server error message
		if (e.response && e.response.data && e.response.data.message)
			throw new Error(e.response.data.message);
		else
			throw e;
	}
}


