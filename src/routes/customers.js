const { json }      = require('../utils/response')
const { parseBody } = require('../utils/parseBody')
const {
  listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer,
} = require('../services/customerService')
const { listContacts, createContact, updateContact, deleteContact } = require('../services/contactService')
const { listInteractions, createInteraction } = require('../services/interactionService')

module.exports = [
  { method: 'GET', pathname: '/api/customers', handler: async (req, res, params, query) => {
    const q = new URLSearchParams(query || '')
    json(res, await listCustomers({ search: q.get('search') || '', email: q.get('email') || '' }))
  }},
  { method: 'POST', pathname: '/api/customers', handler: async (req, res) => {
    const body = await parseBody(req)
    if (!body.name) return json(res, { error: 'name is required' }, 400)
    json(res, await createCustomer(body), 201)
  }},
  { method: 'GET', pathname: '/api/customers/:id', handler: async (req, res, params) => {
    const data = await getCustomer(params.id)
    if (!data) return json(res, { error: 'Not found' }, 404)
    json(res, data)
  }},
  { method: 'PUT', pathname: '/api/customers/:id', handler: async (req, res, params) => {
    const body = await parseBody(req)
    json(res, await updateCustomer(params.id, body))
  }},
  { method: 'DELETE', pathname: '/api/customers/:id', handler: async (req, res, params) => {
    json(res, await deleteCustomer(params.id))
  }},

  { method: 'GET', pathname: '/api/customers/:id/contacts', handler: async (req, res, params) => {
    json(res, await listContacts(params.id))
  }},
  { method: 'POST', pathname: '/api/customers/:id/contacts', handler: async (req, res, params) => {
    const body = await parseBody(req)
    if (!body.name) return json(res, { error: 'name is required' }, 400)
    json(res, await createContact(params.id, body), 201)
  }},
  { method: 'PUT', pathname: '/api/contacts/:id', handler: async (req, res, params) => {
    const body = await parseBody(req)
    json(res, await updateContact(params.id, body))
  }},
  { method: 'DELETE', pathname: '/api/contacts/:id', handler: async (req, res, params) => {
    json(res, await deleteContact(params.id))
  }},

  { method: 'GET', pathname: '/api/customers/:id/interactions', handler: async (req, res, params, query) => {
    const q = new URLSearchParams(query || '')
    json(res, await listInteractions(params.id, { limit: q.get('limit') || 50 }))
  }},
  { method: 'POST', pathname: '/api/interactions', handler: async (req, res) => {
    const body = await parseBody(req)
    if (!body.customerId) return json(res, { error: 'customerId is required' }, 400)
    if (!body.type)       return json(res, { error: 'type is required' }, 400)
    if (!body.direction)  return json(res, { error: 'direction is required' }, 400)
    json(res, await createInteraction(body), 201)
  }},
]
