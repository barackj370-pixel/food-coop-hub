const inviteUser = async () => {
  const res = await fetch('/api/invite-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      role,
      cluster,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error);
  } else {
    alert('Invitation sent!');
  }
};
