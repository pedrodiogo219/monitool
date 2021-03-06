/*!
 * This file is part of Monitool.
 *
 * Monitool is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Monitool is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Monitool. If not, see <http://www.gnu.org/licenses/>.
 */

import TimeSlot from 'timeslot-dag';
import validator from 'is-my-json-valid';

import Variable from './variable';
import Model from './model';
import schema from '../schema/data-source.json';


const validate = validator(schema);

const strings = Object.freeze({
	fr: Object.freeze({
		collection_site: "Lieu de collecte",
		covered_period: "Période couverte",
		collected_by: "Saisie par"
	}),
	en: Object.freeze({
		collection_site: "Collection site",
		covered_period: "Covered period",
		collected_by: "Collected by"
	}),
	es: Object.freeze({
		collection_site: "Lugar de colecta",
		covered_period: "Periodo",
		collected_by: "Rellenado por"
	})
});

export default class DataSource extends Model {

	constructor(data, project) {
		super(data, validate);

		let entityIds = project.entities.map(e => e.id);

		data.entities.forEach(function(entityId) {
			if (entityIds.indexOf(entityId) === -1)
				throw new Error('invalid_data');
		});

		this.elements = this.elements.map(el => new Variable(el));
	}

	get structure() {
		let s = {};
		this.elements.forEach(element => s[element.id] = element.structure);
		return s;
	}

	isValidSlot(slot) {
		const timeSlot = new TimeSlot(slot);

		if (this.periodicity === 'free' && timeSlot.periodicity !== 'day')
			return false;

		if (this.periodicity !== 'free' && timeSlot.periodicity !== this.periodicity)
			return false;

		return true;
	}

	/**
	 * Retrieve a variable by id
	 */
	getVariableById(id) {
		return this.elements.find(el => el.id === id);
	}

	getPdfDocDefinition(pageOrientation, language='en') {
		var doc = {};
		doc.pageSize = "A4";
		doc.pageOrientation = pageOrientation;

		doc.content = [
			{text: this.name, style: 'header'},
			{
				columns: [
					[
						{style: "variableName", text: strings[language].collection_site},
						{
							table: {headerRows: 0, widths: ['*'], body: [[{style: "normal", text: ' '}]]},
							margin: [0, 0, 10, 0]
						}
					],
					[
						{style: "variableName", text: strings[language].covered_period},
						{
							table: {headerRows: 0, widths: ['*'], body: [[{style: "normal", text: ' '}]]},
							margin: [0, 0, 10, 0]
						},
					],
					[
						{style: "variableName", text: strings[language].collected_by},
						{
							table: {headerRows: 0, widths: ['*'], body: [[{style: "normal", text: ' '}]]},
							margin: [0, 0, 0, 0]
						}
					]
				]
			}
		].concat(this.elements.map(el => el.getPdfDocDefinition()));

		return doc;
	}

}
