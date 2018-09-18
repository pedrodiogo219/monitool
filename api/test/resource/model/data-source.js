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

"use strict";

require('../../mock-database');

var assert     = require('assert'),
	DataSource = require('../../../resource/model/data-source');

describe('DataSource', function() {
	var dataSource;

	before(function() {
		dataSource = new DataSource({
			id: "1760d546-cccf-43fe-8f28-1e40a05f23b5",
			name: "a data source",
			periodicity: "month",
			siteIds: ["0c243e08-8c21-4946-9f5f-ce255106901b"],
			start: null,
			end: null,
			variables: [
				{
					id: "d986f4bc-a0b6-4269-a847-78b195185b06",
					name: "variable 1",
					order: 0, distribution: 0, timeAgg: 'sum', geoAgg: 'sum',
					partitions: []
				},
				{
					id: "5b1dd275-2c74-4d74-b5f6-33225fc14d12",
					name: 'variable 2',
					order: 0, distribution: 0, timeAgg: 'sum', geoAgg: 'sum',
					partitions: []
				}
			]
		}, require('../../data/project.json'));
	});


	describe("signature", function() {
		var newDataSource;

		beforeEach(function() {
			newDataSource = new DataSource(JSON.parse(JSON.stringify(dataSource)), require('../../data/project.json'));
		});

		it('renaming the data source should not change anything', function() {
			newDataSource.name = "newName"

			assert.equal(dataSource.signature, newDataSource.signature);
		});

		it('Inverting two variables should not change anything', function() {
			var tmp = newDataSource.variables[0];
			newDataSource.variables[0] = newDataSource.variables[1];
			newDataSource.variables[1] = tmp;

			assert.equal(dataSource.signature, newDataSource.signature);
		});

		it('Adding a variable should change the result', function() {
			newDataSource.variables.push({id: 'variable 3', partitions: []});

			assert.notEqual(dataSource.signature, newDataSource.signature);
		});

		it('Removing a variable should change the result', function() {
			newDataSource.variables.splice(0, 1);

			assert.notEqual(dataSource.signature, newDataSource.signature);
		});
	});

	describe('getVariableById', function() {

		it('should retrieve the first variable', function() {
			assert.equal(
				dataSource.getVariableById('d986f4bc-a0b6-4269-a847-78b195185b06').name,
				'variable 1'
			);
		});

		it('should retrieve the last variable', function() {
			assert.equal(
				dataSource.getVariableById('5b1dd275-2c74-4d74-b5f6-33225fc14d12').name,
				'variable 2'
			);
		});

		it('should return null', function() {
			assert.equal(dataSource.getVariableById('unknownid'), null);
		});

	});

});

