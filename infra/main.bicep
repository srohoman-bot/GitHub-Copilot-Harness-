targetScope = 'subscription'

@minLength(1)
@maxLength(40)
@description('Name of the azd environment; used to derive resource names.')
param environmentName string

@description('Azure region for all resources.')
param location string

@description('Extra comma-separated browser origins allowed to call the API (the Static Web App origin is added automatically).')
param extraOrigins string = ''

var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    environmentName: environmentName
    extraOrigins: extraOrigins
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output API_URL string = resources.outputs.apiUrl
output API_NAME string = resources.outputs.apiName
output WEB_URL string = resources.outputs.webUrl
