async function getRun(runId) {
  const DIFY_DICT_API_KEY = 'app-zGyrsyvvzHAIO5yx11OcYdpa';
  const BASE_URL = 'https://dify.234124123.xyz/v1';

  console.log(`Fetching run details for: ${runId}...`);
  
  try {
    const response = await fetch(`${BASE_URL}/workflows/run/${runId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DIFY_DICT_API_KEY}`
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log('Run Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching run details:', error);
  }
}

getRun('7631fcd4-31d5-4d79-8689-b9abc8970b56');
